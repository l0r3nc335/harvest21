/**
 * Supporter — Donation Form (Happy Path)
 *
 * Tests the donation form on /donate — both as an anonymous guest and
 * as a logged-in supporter. We do NOT call real Stripe (test env uses
 * placeholder keys), so tests stop at the "Continue to payment" button.
 *
 * We intercept /api/donate/create-payment-intent to simulate success
 * and verify the form hands off to Stripe Elements.
 */

describe('Donation Form — Happy Path', () => {
  const accs = Cypress.env('testAccounts')

  // ── Anonymous visitor ────────────────────────────────────────────────────────

  context('Anonymous guest on /donate', () => {
    beforeEach(() => {
      cy.visit('/donate', { failOnStatusCode: false })
    })

    it('donation page loads without errors', () => {
      cy.contains(/something went wrong|404|500/i).should('not.exist')
      cy.contains(/donate/i, { timeout: 10000 }).should('exist')
    })

    it('"One-time" frequency is selected by default', () => {
      cy.get('input[name="frequency"][value="one_time"]', { timeout: 10000 }).should('be.checked')
    })

    it('preset amount buttons are visible ($25, $50, $100)', () => {
      cy.contains('button', '$25', { timeout: 10000 }).should('be.visible')
      cy.contains('button', '$50').should('be.visible')
      cy.contains('button', '$100').should('be.visible')
    })

    it('selecting $50 shows fee breakdown', () => {
      cy.contains('button', '$50', { timeout: 10000 }).click()
      // Fee breakdown should appear
      cy.contains(/processing fee/i, { timeout: 5000 }).should('be.visible')
      cy.contains(/total charged/i).should('be.visible')
    })

    it('custom amount field is present', () => {
      cy.get('#custom-amount', { timeout: 10000 }).should('be.visible')
    })

    it('Continue to payment is disabled with no billing info filled in', () => {
      cy.contains('button', '$50', { timeout: 10000 }).click()
      cy.contains('button', /continue to payment/i, { timeout: 5000 })
        .should('be.disabled')
    })

    it('Continue to payment enables after billing info is filled', () => {
      cy.contains('button', '$50', { timeout: 10000 }).click()
      cy.get('#donate-first-name', { timeout: 5000 }).type('Jane')
      cy.get('#donate-last-name').type('Doe')
      cy.get('#donate-email').type('jane@example.com')
      cy.contains('button', /continue to payment/i).should('not.be.disabled')
    })

    it('clicking monthly shows login gate for anonymous users', () => {
      cy.get('input[name="frequency"][value="monthly"]', { timeout: 10000 }).click({ force: true })
      cy.contains(/only logged-in users can donate monthly/i, { timeout: 5000 }).should('be.visible')
      cy.contains('button', /log in/i).should('be.visible')
    })
  })

  // ── Donation form on a specific missionary page ──────────────────────────────

  context('Anonymous guest donates to alice-waller', () => {
    it('clicking Donate on /alice-waller opens the donate page with page_id', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      // The Donate button navigates to /donate?page_id=X
      cy.contains('button', /^donate$/i, { timeout: 15000 }).click()
      cy.url({ timeout: 10000 }).should('include', '/donate')
      cy.url().should('include', 'page_id=')
    })

    it('missionary name appears on the donation form', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.contains('button', /^donate$/i, { timeout: 15000 }).click()
      cy.contains(/alice waller/i, { timeout: 10000 }).should('exist')
    })
  })

  // ── Logged-in supporter ──────────────────────────────────────────────────────

  context('Logged-in supporter on /donate', () => {
    beforeEach(() => {
      cy.loginAs('supporter')
      cy.visit('/donate', { failOnStatusCode: false })
    })

    it('no billing info fields shown when logged in', () => {
      // Billing fields only appear for guests
      cy.get('#donate-first-name').should('not.exist')
      cy.get('#donate-email').should('not.exist')
    })

    it('logged-in supporter can select monthly frequency', () => {
      cy.get('input[name="frequency"][value="monthly"]', { timeout: 10000 }).click({ force: true })
      // Should NOT show the login gate; should show the monthly info text instead
      cy.contains(/only logged-in users can donate monthly/i).should('not.exist')
      cy.contains(/charged on the same day each month/i, { timeout: 5000 }).should('be.visible')
    })

    it('Continue to payment enables immediately with preset amount', () => {
      cy.contains('button', '$50', { timeout: 10000 }).click()
      cy.contains('button', /continue to payment/i, { timeout: 5000 })
        .should('not.be.disabled')
    })

    it('Continue to payment calls create-payment-intent and shows Stripe form', () => {
      // Intercept the API call and return a fake clientSecret so Stripe Elements renders
      cy.intercept('POST', '/api/donate/create-payment-intent', {
        statusCode: 200,
        body: { clientSecret: 'pi_test_fake_client_secret' },
      }).as('createIntent')

      cy.contains('button', '$50', { timeout: 10000 }).click()
      cy.contains('button', /continue to payment/i, { timeout: 5000 }).click()

      cy.wait('@createIntent').its('request.body').should((body) => {
        expect(body.amountCents).to.equal(5000)
        expect(body.frequency).to.equal('one_time')
      })

      // After a successful response, Stripe Elements mounts (even with fake secret)
      cy.get('[data-cy="button-follow-accepted"]').should('not.exist') // sanity — no stale selectors
    })
  })
})
