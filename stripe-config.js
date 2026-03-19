// ===== NZ Services Directory — Stripe Configuration =====
// 
// HOW TO SET UP:
// 1. Create a Stripe account at https://stripe.com
// 2. In the Stripe Dashboard, create two Payment Links:
//    - Professional plan: $29/month recurring
//    - Business plan: $79/month recurring
// 3. Paste the Payment Link URLs below.
//
// To create a Payment Link in Stripe:
//   Dashboard → Payment Links → + New → Add a product → Set price → Create link
//   Choose "Recurring" for the billing type.
//
// The {CHECKOUT_SESSION_ID} will be appended by Stripe automatically 
// when using the success_url parameter.

const STRIPE_CONFIG = {
    // Paste your Stripe Payment Link URLs here
    professionalPaymentLink: '',  // e.g. 'https://buy.stripe.com/test_abc123'
    businessPaymentLink: '',      // e.g. 'https://buy.stripe.com/test_xyz789'

    // After payment, Stripe redirects here
    successUrl: 'payment-success.html',
    cancelUrl: 'premium.html'
};

// ===== Stripe Checkout Redirect =====

function startCheckout(plan) {
    var link = '';

    if (plan === 'professional') {
        link = STRIPE_CONFIG.professionalPaymentLink;
    } else if (plan === 'business') {
        link = STRIPE_CONFIG.businessPaymentLink;
    }

    if (!link) {
        // Payment links not configured yet — show helpful message
        if (typeof showPageToast === 'function') {
            showPageToast('Payment system is being set up. Please contact us to subscribe.');
        }
        return;
    }

    // If user is logged in via Supabase, append their email as prefill
    // and user ID as client_reference_id for webhook matching
    if (typeof getSupabase === 'function' && isSupabaseConfigured()) {
        var sb = getSupabase();
        sb.auth.getUser().then(function (result) {
            var user = result.data && result.data.user;
            if (user) {
                var separator = link.indexOf('?') === -1 ? '?' : '&';
                link += separator + 'prefilled_email=' + encodeURIComponent(user.email);
                link += '&client_reference_id=' + encodeURIComponent(user.id);
            }
            window.location.href = link;
        }).catch(function () {
            window.location.href = link;
        });
    } else {
        window.location.href = link;
    }
}
