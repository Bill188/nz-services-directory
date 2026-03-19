// ===== NZ Services Directory — Supabase Client =====
// Configure your Supabase project URL and anon key below.
// These are safe to expose in client-side code (they are public/anon keys).

const SUPABASE_URL = 'https://josvgjssrpfrfuygmbum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvc3ZnanNzcnBmcmZ1eWdtYnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzcxNjcsImV4cCI6MjA4OTQxMzE2N30.LQ0qk-2fvh3wszTUr9HTK_PfusStDxksmaeLsMxKs_s';

// ===== Client Initialization =====
let _supabase = null;

function getSupabase() {
    if (_supabase) return _supabase;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (typeof window.supabase === 'undefined') return null;
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabase;
}

function isSupabaseConfigured() {
    return !!getSupabase();
}

// ===== Auth Functions =====

async function supabaseSignUp(email, password, fullName) {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { full_name: fullName, role: 'provider' }
        }
    });
    if (error) throw error;
    return data;
}

async function supabaseSignIn(email, password) {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) throw error;
    return data;
}

async function supabaseSignOut() {
    const sb = getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
}

async function supabaseGetUser() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user;
}

function supabaseOnAuthChange(callback) {
    const sb = getSupabase();
    return sb.auth.onAuthStateChange(function (_event, session) {
        callback(session ? session.user : null);
    });
}

// ===== Listings: Query =====

async function supabaseFetchListings(options) {
    var sb = getSupabase();
    var type = options.type || 'all';
    var category = options.category || '';
    var region = options.region || '';
    var search = options.search || '';
    var sort = options.sort || 'featured';
    var limit = options.limit || 9;
    var offset = options.offset || 0;

    var query = sb
        .from('listings')
        .select('*', { count: 'exact' });

    // Filters
    if (type !== 'all') {
        query = query.eq('type', type);
    }
    if (category) {
        query = query.eq('category_id', category);
    }
    if (region) {
        query = query.eq('region_id', region);
    }

    // Full-text search
    if (search) {
        query = query.textSearch('fts', search, { type: 'websearch' });
    }

    // Sort
    switch (sort) {
        case 'featured':
            query = query.order('featured', { ascending: false }).order('rating', { ascending: false });
            break;
        case 'rating':
            query = query.order('rating', { ascending: false });
            break;
        case 'reviews':
            query = query.order('review_count', { ascending: false });
            break;
        case 'name-asc':
            query = query.order('name', { ascending: true });
            break;
        case 'name-desc':
            query = query.order('name', { ascending: false });
            break;
        case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
        default:
            query = query.order('featured', { ascending: false }).order('rating', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    var { data, count, error } = await query;
    if (error) throw error;

    // Map DB columns → existing frontend field names
    var listings = (data || []).map(function (row) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            category: row.category_id,
            region: row.region_id,
            city: row.city,
            phone: row.phone,
            email: row.email,
            website: row.website || '',
            rating: parseFloat(row.rating) || 0,
            reviews: row.review_count || 0,
            verified: row.verified,
            featured: row.featured,
            description: row.description,
            services: row.services || []
        };
    });

    return { listings: listings, total: count || 0 };
}

async function supabaseFetchListingById(id) {
    var sb = getSupabase();
    var { data, error } = await sb
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return {
        id: data.id,
        name: data.name,
        type: data.type,
        category: data.category_id,
        region: data.region_id,
        city: data.city,
        phone: data.phone,
        email: data.email,
        website: data.website || '',
        rating: parseFloat(data.rating) || 0,
        reviews: data.review_count || 0,
        verified: data.verified,
        featured: data.featured,
        description: data.description,
        services: data.services || []
    };
}

// ===== Listings: Create =====

async function supabaseCreateListing(listingData) {
    var sb = getSupabase();
    var user = await supabaseGetUser();
    if (!user) throw new Error('You must be signed in to submit a listing.');

    var { data, error } = await sb
        .from('listings')
        .insert({
            user_id: user.id,
            name: listingData.name,
            type: listingData.type,
            category_id: listingData.category,
            region_id: listingData.region,
            city: listingData.city || '',
            phone: listingData.phone,
            email: listingData.email,
            website: listingData.website || '',
            description: listingData.description,
            services: listingData.services || [],
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ===== Region & Category Counts (live from DB) =====

async function supabaseFetchRegionCounts() {
    var sb = getSupabase();
    var { data, error } = await sb.rpc('get_region_counts');
    if (error) throw error;
    var map = {};
    (data || []).forEach(function (r) { map[r.region_id] = parseInt(r.count); });
    return map;
}

async function supabaseFetchCategoryCounts() {
    var sb = getSupabase();
    var { data, error } = await sb.rpc('get_category_counts');
    if (error) throw error;
    var map = {};
    (data || []).forEach(function (c) { map[c.category_id] = parseInt(c.count); });
    return map;
}
