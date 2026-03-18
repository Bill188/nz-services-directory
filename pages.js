// ===== NZ Services Directory — Pages Shared JS =====
(function () {
    'use strict';

    // Navbar scroll effect
    var navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', function () {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        });
    }

    // Mobile menu
    var mobileBtn = document.getElementById('mobileMenuBtn');
    var navLinks = document.getElementById('navLinks');
    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', function () {
            navLinks.classList.toggle('active');
            var spans = mobileBtn.querySelectorAll('span');
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
    }

    // FAQ Toggle
    window.toggleFAQ = function (btn) {
        var item = btn.closest('.faq-item');
        var wasOpen = item.classList.contains('open');
        // Close all others in same category
        var category = item.closest('.faq-category');
        if (category) {
            category.querySelectorAll('.faq-item.open').forEach(function (el) {
                el.classList.remove('open');
            });
        }
        if (!wasOpen) {
            item.classList.add('open');
        }
    };

    // FAQ Search/Filter
    window.filterFAQ = function (query) {
        var q = query.toLowerCase().trim();
        document.querySelectorAll('.faq-item').forEach(function (item) {
            var keywords = (item.getAttribute('data-keywords') || '') + ' ' +
                           (item.querySelector('.faq-question') ? item.querySelector('.faq-question').textContent : '');
            if (!q || keywords.toLowerCase().indexOf(q) !== -1) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    };

    // Contact form
    window.submitContactForm = function () {
        var form = document.getElementById('contactForm');
        if (form) {
            showPageToast('Message sent! We\'ll get back to you within 1 business day.');
            form.reset();
        }
    };

    // Report form
    window.submitReportForm = function () {
        var form = document.getElementById('reportForm');
        if (form) {
            showPageToast('Report submitted. Our team will review it within 24 hours.');
            form.reset();
        }
    };

    // Toast notification
    window.showPageToast = function (message) {
        var toast = document.getElementById('toast');
        var msgEl = document.getElementById('toastMessage');
        if (toast && msgEl) {
            msgEl.textContent = message;
            toast.classList.add('active');
            setTimeout(function () {
                toast.classList.remove('active');
            }, 4000);
        }
    };

})();
