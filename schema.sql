-- =============================================
-- NZ Services Directory — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Regions table
CREATE TABLE regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

-- 2. Categories table
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📋',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    bg_color TEXT NOT NULL DEFAULT '#EFF6FF',
    sort_order INT DEFAULT 0
);

-- 3. Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'provider', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Listings table
CREATE TABLE listings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('independent', 'agency')),
    category_id TEXT NOT NULL REFERENCES categories(id),
    region_id TEXT NOT NULL REFERENCES regions(id),
    city TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT,
    description TEXT NOT NULL,
    services TEXT[] DEFAULT '{}',
    rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count INT DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Reviews table
CREATE TABLE reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewer_name TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Contact enquiries table
CREATE TABLE enquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes for fast queries
-- =============================================
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_region ON listings(region_id);
CREATE INDEX idx_listings_type ON listings(type);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_rating ON listings(rating DESC);
CREATE INDEX idx_listings_featured ON listings(featured DESC, rating DESC);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_reviews_listing ON reviews(listing_id);

-- Full-text search index
ALTER TABLE listings ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(city, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(array_to_string(services, ' '), '')), 'C')
    ) STORED;
CREATE INDEX idx_listings_fts ON listings USING gin(fts);

-- =============================================
-- Function: Update listing rating from reviews
-- =============================================
CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE listings SET
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE listing_id = COALESCE(NEW.listing_id, OLD.listing_id)), 0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE listing_id = COALESCE(NEW.listing_id, OLD.listing_id)),
        updated_at = now()
    WHERE id = COALESCE(NEW.listing_id, OLD.listing_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_change
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- =============================================
-- Function: Auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- Function: Get region listing counts
-- =============================================
CREATE OR REPLACE FUNCTION get_region_counts()
RETURNS TABLE(region_id TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT l.region_id, COUNT(*)::BIGINT
    FROM listings l
    WHERE l.status = 'approved'
    GROUP BY l.region_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get category listing counts
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(category_id TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT l.category_id, COUNT(*)::BIGINT
    FROM listings l
    WHERE l.status = 'approved'
    GROUP BY l.category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved listings public" ON listings FOR SELECT USING (status = 'approved');
CREATE POLICY "Users insert own listings" ON listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own listings" ON listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own listings" ON listings FOR DELETE USING (auth.uid() = user_id);

-- Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public" ON reviews FOR SELECT USING (true);
CREATE POLICY "Auth users insert reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- Enquiries
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit enquiry" ON enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Providers view own enquiries" ON enquiries FOR SELECT
    USING (listing_id IN (SELECT id FROM listings WHERE user_id = auth.uid()));

-- Regions & Categories: public read
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regions public" ON regions FOR SELECT USING (true);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories public" ON categories FOR SELECT USING (true);

-- =============================================
-- Seed data: Regions
-- =============================================
INSERT INTO regions (id, name, city, sort_order) VALUES
('northland', 'Northland', 'Whangārei', 1),
('auckland', 'Auckland', 'Auckland', 2),
('waikato', 'Waikato', 'Hamilton', 3),
('bay-of-plenty', 'Bay of Plenty', 'Tauranga', 4),
('gisborne', 'Gisborne', 'Gisborne', 5),
('hawkes-bay', 'Hawke''s Bay', 'Napier', 6),
('taranaki', 'Taranaki', 'New Plymouth', 7),
('manawatu-whanganui', 'Manawatū-Whanganui', 'Palmerston North', 8),
('wellington', 'Wellington', 'Wellington', 9),
('nelson-tasman', 'Nelson-Tasman', 'Nelson', 10),
('marlborough', 'Marlborough', 'Blenheim', 11),
('west-coast', 'West Coast', 'Greymouth', 12),
('canterbury', 'Canterbury', 'Christchurch', 13),
('otago', 'Otago', 'Dunedin', 14),
('southland', 'Southland', 'Invercargill', 15);

-- Seed data: Categories
INSERT INTO categories (id, name, icon, color, bg_color, sort_order) VALUES
('plumbing', 'Plumbing', '🔧', '#3B82F6', '#EFF6FF', 1),
('electrical', 'Electrical', '⚡', '#F59E0B', '#FFFBEB', 2),
('building', 'Building & Construction', '🏗️', '#EF4444', '#FEF2F2', 3),
('cleaning', 'Cleaning', '✨', '#06B6D4', '#ECFEFF', 4),
('landscaping', 'Landscaping', '🌿', '#22C55E', '#F0FDF4', 5),
('painting', 'Painting & Decorating', '🎨', '#A855F7', '#FAF5FF', 6),
('roofing', 'Roofing', '🏠', '#78716C', '#FAFAF9', 7),
('it-tech', 'IT & Technology', '💻', '#6366F1', '#EEF2FF', 8),
('accounting', 'Accounting & Finance', '📊', '#0D9488', '#F0FDFA', 9),
('legal', 'Legal Services', '⚖️', '#1E293B', '#F8FAFC', 10),
('health', 'Health & Wellness', '🏥', '#EC4899', '#FDF2F8', 11),
('automotive', 'Automotive', '🚗', '#64748B', '#F1F5F9', 12),
('photography', 'Photography', '📸', '#D946EF', '#FDF4FF', 13),
('events', 'Event Planning', '🎉', '#F97316', '#FFF7ED', 14),
('real-estate', 'Real Estate', '🏡', '#14B8A6', '#F0FDFA', 15),
('education', 'Education & Tutoring', '📚', '#8B5CF6', '#F5F3FF', 16),
('locksmith', 'Locksmith', '🔑', '#CA8A04', '#FEFCE8', 17),
('pest-control', 'Pest Control', '🐛', '#65A30D', '#F7FEE7', 18),
('moving', 'Moving & Removals', '📦', '#0284C7', '#F0F9FF', 19),
('security', 'Security Services', '🔒', '#334155', '#F8FAFC', 20);

-- =============================================
-- Seed data: Sample listings (approved)
-- =============================================
INSERT INTO listings (name, type, category_id, region_id, city, phone, email, website, description, services, rating, review_count, verified, featured, status) VALUES
('Mike Thompson Plumbing', 'independent', 'plumbing', 'auckland', 'Auckland CBD', '021 345 6789', 'mike@thompsonplumbing.co.nz', 'thompsonplumbing.co.nz', 'Master plumber with 20+ years experience serving Auckland. Specialising in residential repairs, hot water systems, and bathroom renovations.', ARRAY['Emergency Repairs','Hot Water Systems','Bathroom Renovation','Drain Clearing','Gas Fitting'], 4.9, 127, true, true, 'approved'),
('Kiwi Electrical Solutions', 'agency', 'electrical', 'wellington', 'Lower Hutt', '04 567 8901', 'info@kiwielectrical.co.nz', 'kiwielectrical.co.nz', 'Wellington''s trusted electrical agency with a team of 15 certified electricians. Commercial and residential services.', ARRAY['New Builds','Rewiring','Smart Home','Commercial Fit-out','Safety Inspections','EV Chargers'], 4.8, 203, true, true, 'approved'),
('Sarah Chen Photography', 'independent', 'photography', 'otago', 'Queenstown', '027 890 1234', 'hello@sarahchen.co.nz', 'sarahchenphotography.co.nz', 'Award-winning photographer based in Queenstown. Specialising in weddings, elopements, and corporate events.', ARRAY['Weddings','Elopements','Corporate Events','Portraits','Commercial'], 5.0, 89, true, true, 'approved'),
('Canterbury Build Group', 'agency', 'building', 'canterbury', 'Christchurch', '03 345 6789', 'projects@canterburybuild.co.nz', 'canterburybuild.co.nz', 'Full-service construction company rebuilding Canterbury since 2011. New homes, commercial buildings, and earthquake strengthening.', ARRAY['New Homes','Commercial','Earthquake Strengthening','Renovations','Project Management'], 4.7, 312, true, true, 'approved'),
('GreenScape Landscapes', 'agency', 'landscaping', 'auckland', 'North Shore', '09 456 7890', 'design@greenscapenz.co.nz', 'greenscapenz.co.nz', 'Award-winning landscape design and construction on Auckland''s North Shore.', ARRAY['Garden Design','Retaining Walls','Paving','Planting','Irrigation','Outdoor Living'], 4.8, 156, true, false, 'approved'),
('Tara Williams — Barrister & Solicitor', 'independent', 'legal', 'wellington', 'Wellington CBD', '04 234 5678', 'tara@williamslegal.co.nz', 'williamslegal.co.nz', 'Experienced family and employment lawyer practicing in Wellington.', ARRAY['Family Law','Employment Law','Mediation','Property Law','Wills & Trusts'], 4.9, 67, true, false, 'approved'),
('TechForward IT Services', 'agency', 'it-tech', 'auckland', 'Parnell', '09 876 5432', 'support@techforward.co.nz', 'techforward.co.nz', 'Auckland''s leading managed IT services provider. Supporting SMEs with network management, cybersecurity, and cloud migration.', ARRAY['Managed IT','Cybersecurity','Cloud Services','Helpdesk','Network Setup','Data Backup'], 4.6, 234, true, true, 'approved'),
('Clean & Gleam NZ', 'agency', 'cleaning', 'waikato', 'Hamilton', '07 345 6789', 'book@cleanandgleam.co.nz', 'cleanandgleam.co.nz', 'Professional cleaning services across the Waikato region. Residential, commercial, and end-of-tenancy cleaning.', ARRAY['House Cleaning','Office Cleaning','End of Tenancy','Carpet Cleaning','Window Cleaning'], 4.7, 189, true, false, 'approved'),
('Dave''s Roofing Northland', 'independent', 'roofing', 'northland', 'Whangārei', '021 567 8901', 'dave@davesroofing.co.nz', 'davesroofing.co.nz', 'Northland''s trusted roofer. Re-roofing, repairs, spouting, and fascia.', ARRAY['Re-roofing','Repairs','Spouting','Fascia','Colorsteel','Tile Roofing'], 4.8, 76, true, false, 'approved'),
('Aroha Accounting', 'agency', 'accounting', 'bay-of-plenty', 'Tauranga', '07 234 5678', 'team@arohaaccounting.co.nz', 'arohaaccounting.co.nz', 'Chartered accountants and business advisors in Tauranga. Tax returns, GST, payroll, and business planning.', ARRAY['Tax Returns','GST','Payroll','Business Planning','Company Setup','Xero Advisory'], 4.9, 145, true, true, 'approved'),
('Peak Fitness Coaching', 'independent', 'health', 'canterbury', 'Christchurch', '027 123 4567', 'coach@peakfitness.co.nz', 'peakfitness.co.nz', 'Personal training and wellness coaching in Christchurch.', ARRAY['Personal Training','Nutrition Plans','Rehabilitation','Group Fitness','Online Coaching'], 4.9, 98, true, false, 'approved'),
('Precision Painters', 'agency', 'painting', 'auckland', 'East Auckland', '09 567 8901', 'quotes@precisionpainters.co.nz', 'precisionpainters.co.nz', 'Professional painting and decorating services across Auckland.', ARRAY['Interior Painting','Exterior Painting','Wallpapering','Roof Painting','Commercial'], 4.6, 167, true, false, 'approved'),
('Taranaki Auto Specialists', 'agency', 'automotive', 'taranaki', 'New Plymouth', '06 789 0123', 'service@taranakauto.co.nz', 'taranakauto.co.nz', 'Full-service automotive workshop in New Plymouth.', ARRAY['WOF Inspections','Full Servicing','Repairs','European Cars','Performance','Diagnostics'], 4.7, 112, true, false, 'approved'),
('Celebrate Events Co.', 'agency', 'events', 'wellington', 'Wellington', '04 890 1234', 'hello@celebrateco.co.nz', 'celebrateco.co.nz', 'Wellington''s premier event planning company.', ARRAY['Wedding Planning','Corporate Events','Private Parties','Festival Management','Styling'], 4.8, 78, true, false, 'approved'),
('Ben Taylor — Locksmith', 'independent', 'locksmith', 'canterbury', 'Christchurch', '027 456 7890', 'ben@bentaylorlocksmith.co.nz', 'bentaylorlocksmith.co.nz', 'Emergency and scheduled locksmith services across Canterbury.', ARRAY['Emergency Lockout','Lock Changes','Key Cutting','Automotive','Security Systems','Safes'], 4.8, 54, true, false, 'approved'),
('Hauraki Pest Solutions', 'independent', 'pest-control', 'waikato', 'Thames', '021 678 9012', 'help@haurakipest.co.nz', 'haurakipest.co.nz', 'Pest control expert covering the Waikato and Coromandel.', ARRAY['Rodent Control','Possum Removal','Wasp Nests','Spider Treatment','Commercial Pest Management'], 4.5, 43, true, false, 'approved'),
('Southern Move Logistics', 'agency', 'moving', 'otago', 'Dunedin', '03 456 7890', 'book@southernmove.co.nz', 'southernmove.co.nz', 'Professional moving and removals service based in Dunedin.', ARRAY['Local Moves','Long Distance','Packing','Storage','Office Relocation','Piano Moving'], 4.6, 89, true, false, 'approved'),
('Hawke''s Bay Real Estate Group', 'agency', 'real-estate', 'hawkes-bay', 'Napier', '06 345 6789', 'sales@hbrealestate.co.nz', 'hbrealestate.co.nz', 'Leading real estate agency in Hawke''s Bay.', ARRAY['Residential Sales','Commercial Sales','Property Management','Valuations','Auctions'], 4.7, 178, true, true, 'approved'),
('NZ Security Professionals', 'agency', 'security', 'auckland', 'Manukau', '09 234 5678', 'operations@nzsecuritypro.co.nz', 'nzsecuritypro.co.nz', 'Licensed security company providing guard services and event security across Auckland.', ARRAY['Guard Services','Event Security','Mobile Patrols','CCTV Installation','Access Control'], 4.5, 123, true, false, 'approved'),
('Maths Mastery Tutoring', 'independent', 'education', 'wellington', 'Porirua', '021 012 3456', 'learn@mathsmastery.co.nz', 'mathsmastery.co.nz', 'Expert maths tutor helping students from Year 7 through to university level.', ARRAY['NCEA Maths','Cambridge Maths','University Prep','Small Groups','Online Tutoring'], 4.9, 67, true, false, 'approved'),
('Auckland Auto Clinic', 'independent', 'automotive', 'auckland', 'Grey Lynn', '09 789 0123', 'service@aucklandautoclinic.co.nz', 'aucklandautoclinic.co.nz', 'Independent mechanic in Grey Lynn specialising in Japanese and Korean vehicles.', ARRAY['WOF Testing','Full Service','Repairs','Japanese Cars','Korean Cars','Diagnostics'], 4.8, 198, true, true, 'approved'),
('All Blacks Moving Co.', 'agency', 'moving', 'auckland', 'Penrose', '09 678 9012', 'move@allblacksmoving.co.nz', 'allblacksmoving.co.nz', 'Auckland''s most trusted moving company. Local moves, nationwide relocations, and international shipping.', ARRAY['Local Moves','Nationwide','International','Packing Service','Storage','Commercial Moves'], 4.7, 234, true, true, 'approved');
