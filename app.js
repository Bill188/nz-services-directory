// ===== NZ Services Directory — Application Logic =====

(function () {
    'use strict';

    // State
    let currentType = 'all';
    let currentCategory = '';
    let currentRegion = '';
    let currentSort = 'featured';
    let searchQuery = '';
    let displayCount = 9;
    const PAGE_SIZE = 9;

    // ===== Initialization =====
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        renderCategories();
        renderRegions();
        populateFilterDropdowns();
        renderListings();
        initNavbar();
        initMobileMenu();
        animateCounters();
        initSmoothScroll();
    }

    // ===== Navbar Scroll Effect =====
    function initNavbar() {
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', function () {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        });
    }

    // ===== Mobile Menu =====
    function initMobileMenu() {
        const btn = document.getElementById('mobileMenuBtn');
        const navLinks = document.getElementById('navLinks');

        btn.addEventListener('click', function () {
            navLinks.classList.toggle('active');
            const spans = btn.querySelectorAll('span');
            if (navLinks.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                spans[0].style.transform = '';
                spans[1].style.opacity = '';
                spans[2].style.transform = '';
            }
        });

        // Close mobile menu on nav link click
        navLinks.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('active');
                const spans = btn.querySelectorAll('span');
                spans[0].style.transform = '';
                spans[1].style.opacity = '';
                spans[2].style.transform = '';
            });
        });
    }

    // ===== Smooth Scroll for Nav Links =====
    function initSmoothScroll() {
        document.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                    // Update active state
                    document.querySelectorAll('.nav-link').forEach(function (l) { l.classList.remove('active'); });
                    this.classList.add('active');
                }
            });
        });
    }

    // ===== Animated Counters =====
    function animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.getAttribute('data-count'));
                    animateNumber(el, 0, target, 1500);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(function (counter) { observer.observe(counter); });
    }

    function animateNumber(el, start, end, duration) {
        const range = end - start;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.floor(start + range * eased);
            el.textContent = current.toLocaleString() + (end >= 1000 ? '+' : '');
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    // ===== Render Categories =====
    function renderCategories(showAll) {
        var grid = document.getElementById('categoriesGrid');
        var cats = showAll ? CATEGORIES : CATEGORIES.slice(0, 12);
        grid.innerHTML = cats.map(function (cat) {
            return '<div class="category-card" onclick="filterByCategory(\'' + cat.id + '\')" style="--cat-color:' + cat.color + '">' +
                '<div class="category-icon" style="background:' + cat.bg + '">' + cat.icon + '</div>' +
                '<h3>' + escapeHtml(cat.name) + '</h3>' +
                '<span>' + cat.count + ' providers</span>' +
            '</div>';
        }).join('');
    }

    // ===== Render Regions =====
    function renderRegions() {
        var grid = document.getElementById('regionsGrid');
        grid.innerHTML = REGIONS.map(function (region) {
            return '<div class="region-card" onclick="filterByRegion(\'' + region.id + '\')">' +
                '<div class="region-icon">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '</div>' +
                '<div class="region-info">' +
                    '<h3>' + escapeHtml(region.name) + '</h3>' +
                    '<span>' + escapeHtml(region.city) + ' · ' + region.count + ' services</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ===== Populate Filter Dropdowns =====
    function populateFilterDropdowns() {
        var catSelect = document.getElementById('filterCategory');
        var regSelect = document.getElementById('filterRegion');
        var listCatSelect = document.getElementById('listCategory');
        var listRegSelect = document.getElementById('listRegion');

        CATEGORIES.forEach(function (cat) {
            var opt = '<option value="' + cat.id + '">' + escapeHtml(cat.name) + '</option>';
            catSelect.innerHTML += opt;
            if (listCatSelect) listCatSelect.innerHTML += opt;
        });

        REGIONS.forEach(function (region) {
            var opt = '<option value="' + region.id + '">' + escapeHtml(region.name) + '</option>';
            regSelect.innerHTML += opt;
            if (listRegSelect) listRegSelect.innerHTML += opt;
        });
    }

    // ===== Get Filtered Listings =====
    function getFilteredListings() {
        var results = LISTINGS.filter(function (listing) {
            if (currentType !== 'all' && listing.type !== currentType) return false;
            if (currentCategory && listing.category !== currentCategory) return false;
            if (currentRegion && listing.region !== currentRegion) return false;
            if (searchQuery) {
                var q = searchQuery.toLowerCase();
                var searchable = (listing.name + ' ' + listing.description + ' ' + listing.category + ' ' + listing.city + ' ' + listing.services.join(' ')).toLowerCase();
                if (searchable.indexOf(q) === -1) return false;
            }
            return true;
        });

        // Sort
        switch (currentSort) {
            case 'featured':
                results.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.rating - a.rating; });
                break;
            case 'rating':
                results.sort(function (a, b) { return b.rating - a.rating; });
                break;
            case 'reviews':
                results.sort(function (a, b) { return b.reviews - a.reviews; });
                break;
            case 'name-asc':
                results.sort(function (a, b) { return a.name.localeCompare(b.name); });
                break;
            case 'name-desc':
                results.sort(function (a, b) { return b.name.localeCompare(a.name); });
                break;
        }

        return results;
    }

    // ===== Render Listings =====
    function renderListings() {
        var grid = document.getElementById('listingsGrid');
        var allResults = getFilteredListings();
        var results = allResults.slice(0, displayCount);
        var countEl = document.getElementById('resultsCount');
        var loadMoreContainer = document.getElementById('loadMoreContainer');

        countEl.textContent = allResults.length;

        if (results.length === 0) {
            grid.innerHTML = '<div class="no-results">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/></svg>' +
                '<h3>No services found</h3>' +
                '<p>Try adjusting your filters or search terms</p>' +
            '</div>';
            loadMoreContainer.style.display = 'none';
            return;
        }

        loadMoreContainer.style.display = allResults.length > displayCount ? '' : 'none';

        grid.innerHTML = results.map(function (listing) {
            var initials = listing.name.split(' ').slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
            var color = AVATAR_COLORS[listing.id % AVATAR_COLORS.length];
            var stars = generateStars(listing.rating);
            var regionObj = REGIONS.find(function (r) { return r.id === listing.region; });
            var categoryObj = CATEGORIES.find(function (c) { return c.id === listing.category; });

            return '<div class="listing-card" onclick="showDetail(' + listing.id + ')">' +
                '<div class="listing-header">' +
                    '<div class="listing-avatar" style="background:' + color + '">' + escapeHtml(initials) + '</div>' +
                    '<div class="listing-info">' +
                        '<div class="listing-name">' + escapeHtml(listing.name) + '</div>' +
                        '<div class="listing-category">' + (categoryObj ? escapeHtml(categoryObj.name) : '') + '</div>' +
                        '<div class="listing-badges">' +
                            '<span class="badge badge-' + listing.type + '">' + (listing.type === 'independent' ? 'Independent' : 'Agency') + '</span>' +
                            (listing.verified ? '<span class="badge badge-verified">✓ Verified</span>' : '') +
                            (listing.featured ? '<span class="badge badge-featured">★ Featured</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="listing-body">' +
                    '<p class="listing-desc">' + escapeHtml(listing.description) + '</p>' +
                    '<div class="listing-meta">' +
                        '<div class="listing-meta-item listing-rating">' + stars + ' <strong>' + listing.rating + '</strong> <span>(' + listing.reviews + ')</span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="listing-footer">' +
                    '<div class="listing-location">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                        escapeHtml(listing.city) + ', ' + (regionObj ? escapeHtml(regionObj.name) : '') +
                    '</div>' +
                    '<span class="listing-action">View Details →</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ===== Star Rating Generator =====
    function generateStars(rating) {
        var full = Math.floor(rating);
        var half = rating % 1 >= 0.5 ? 1 : 0;
        var empty = 5 - full - half;
        var stars = '';
        for (var i = 0; i < full; i++) stars += '★';
        for (var j = 0; j < half; j++) stars += '★';
        for (var k = 0; k < empty; k++) stars += '☆';
        return '<span class="stars">' + stars + '</span>';
    }

    // ===== Filter Functions (exposed globally) =====
    window.filterByType = function (type, btn) {
        currentType = type;
        displayCount = PAGE_SIZE;
        document.querySelectorAll('.filter-chip[data-type]').forEach(function (chip) {
            chip.classList.toggle('active', chip.getAttribute('data-type') === type);
        });
        renderListings();
    };

    window.filterByCategory = function (categoryId) {
        currentCategory = categoryId;
        displayCount = PAGE_SIZE;
        document.getElementById('filterCategory').value = categoryId;
        document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
        renderListings();
    };

    window.filterByRegion = function (regionId) {
        currentRegion = regionId;
        displayCount = PAGE_SIZE;
        document.getElementById('filterRegion').value = regionId;
        document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
        renderListings();
    };

    window.applyFilters = function () {
        currentCategory = document.getElementById('filterCategory').value;
        currentRegion = document.getElementById('filterRegion').value;
        currentSort = document.getElementById('filterSort').value;
        displayCount = PAGE_SIZE;
        renderListings();
    };

    window.loadMore = function () {
        displayCount += PAGE_SIZE;
        renderListings();
    };

    window.showAllCategories = function () {
        renderCategories(true);
    };

    window.filterBySort = function (sort) {
        currentSort = sort;
        document.getElementById('filterSort').value = sort === 'newest' ? 'name-asc' : sort;
        displayCount = PAGE_SIZE;
        renderListings();
    };

    // ===== Search =====
    window.performSearch = function () {
        searchQuery = document.getElementById('heroSearch').value.trim();
        var regionSelect = document.getElementById('heroRegion');
        if (regionSelect.value) {
            currentRegion = regionSelect.value;
            document.getElementById('filterRegion').value = regionSelect.value;
        }
        displayCount = PAGE_SIZE;
        document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
        renderListings();
    };

    // Search on Enter key
    document.addEventListener('DOMContentLoaded', function () {
        var heroSearch = document.getElementById('heroSearch');
        if (heroSearch) {
            heroSearch.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.performSearch();
                }
            });
        }
    });

    // ===== Detail Modal =====
    window.showDetail = function (id) {
        var listing = LISTINGS.find(function (l) { return l.id === id; });
        if (!listing) return;

        var color = AVATAR_COLORS[listing.id % AVATAR_COLORS.length];
        var initials = listing.name.split(' ').slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
        var regionObj = REGIONS.find(function (r) { return r.id === listing.region; });
        var categoryObj = CATEGORIES.find(function (c) { return c.id === listing.category; });
        var stars = generateStars(listing.rating);

        var html = '<div class="detail-header">' +
            '<div class="detail-avatar" style="background:' + color + '">' + escapeHtml(initials) + '</div>' +
            '<div class="detail-info">' +
                '<h2>' + escapeHtml(listing.name) + '</h2>' +
                '<div class="detail-category">' + (categoryObj ? escapeHtml(categoryObj.name) : '') +
                    ' · <span class="badge badge-' + listing.type + '">' + (listing.type === 'independent' ? 'Independent' : 'Agency') + '</span>' +
                    (listing.verified ? ' <span class="badge badge-verified">✓ Verified</span>' : '') +
                '</div>' +
                '<div class="detail-rating">' + stars + ' <strong>' + listing.rating + '</strong> <span>(' + listing.reviews + ' reviews)</span></div>' +
            '</div>' +
        '</div>' +
        '<div class="detail-body">' +
            '<h3>About</h3>' +
            '<p>' + escapeHtml(listing.description) + '</p>' +
            '<h3>Services Offered</h3>' +
            '<div class="detail-services">' +
                listing.services.map(function (s) { return '<span class="detail-service-tag">' + escapeHtml(s) + '</span>'; }).join('') +
            '</div>' +
            '<h3>Contact Information</h3>' +
            '<div class="detail-contact">' +
                '<div class="detail-contact-item">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                    escapeHtml(listing.city) + ', ' + (regionObj ? escapeHtml(regionObj.name) : '') +
                '</div>' +
                '<div class="detail-contact-item">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
                    escapeHtml(listing.phone) +
                '</div>' +
                '<div class="detail-contact-item">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
                    escapeHtml(listing.email) +
                '</div>' +
                (listing.website ? '<div class="detail-contact-item">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
                    escapeHtml(listing.website) +
                '</div>' : '') +
            '</div>' +
        '</div>' +
        '<div class="detail-actions">' +
            '<button class="btn btn-primary btn-lg" onclick="showToast(\'Contact request sent to ' + escapeHtml(listing.name).replace(/'/g, "\\'") + '!\')">Get in Touch</button>' +
            '<button class="btn btn-outline btn-lg" onclick="showToast(\'Saved to your favourites!\')">Save</button>' +
        '</div>';

        document.getElementById('detailContent').innerHTML = html;
        openModal('detailModal');
    };

    // ===== Modal Functions =====
    window.openModal = function (id) {
        var modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = function (id) {
        var modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // Close modal on overlay click
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
            e.target.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(function (modal) {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });

    // ===== List Submission Handler =====
    window.handleListSubmit = function () {
        closeModal('listModal');
        showToast('Your listing has been submitted for review! We\'ll be in touch soon.');
    };

    // ===== Toast Notification =====
    window.showToast = function (message) {
        var toast = document.getElementById('toast');
        var msgEl = document.getElementById('toastMessage');
        msgEl.textContent = message;
        toast.classList.add('active');
        setTimeout(function () {
            toast.classList.remove('active');
        }, 3500);
    };

    // ===== HTML Escaping Utility =====
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

})();
