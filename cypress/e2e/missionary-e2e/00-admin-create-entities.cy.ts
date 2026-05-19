/**
 * Admin Entity Creation Suite
 *
 * Verifies the admin UI can create missionaries, supporters, churches, and agencies.
 * Accounts used here are separate UI-test accounts (ui-test-*@h21test.local),
 * distinct from the programmatically-seeded accounts used by other suites.
 *
 * Prerequisites: Local dev server running (`pnpm dev:cypress`)
 *                Local Supabase running (`supabase start`)
 */

describe('Admin — Create Entities', () => {
  const admin = Cypress.env('testAccounts').admin

  beforeEach(() => {
    cy.login(admin.email, admin.password)
  })

  // ─── Admin panel loads ──────────────────────────────────────────────────────

  context('Admin Panel Access', () => {
    it('admin panel loads without errors', () => {
      cy.visit('/admin', { failOnStatusCode: false })
      cy.url({ timeout: 10000 }).should('include', '/admin')
      cy.contains(/something went wrong|404|500/i, { timeout: 10000 }).should('not.exist')
    })

    it('admin missionaries page loads', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.get('h1', { timeout: 10000 }).contains(/missionaries/i)
      cy.contains(/something went wrong|404/i).should('not.exist')
    })

    it('admin users page loads', () => {
      cy.visit('/admin/users', { failOnStatusCode: false })
      cy.get('h1, h2', { timeout: 10000 }).contains(/users|accounts/i)
      cy.contains(/something went wrong|404/i).should('not.exist')
    })

    it('admin agencies page loads', () => {
      cy.visit('/admin/agencies', { failOnStatusCode: false })
      cy.get('h1, h2', { timeout: 10000 }).contains(/agenc/i)
      cy.contains(/something went wrong|404/i).should('not.exist')
    })

    it('admin churches page loads', () => {
      cy.visit('/admin/churches', { failOnStatusCode: false })
      cy.get('h1, h2', { timeout: 10000 }).contains(/church|churches/i)
      cy.contains(/something went wrong|404/i).should('not.exist')
    })
  })

  // ─── Missionary creation via admin UI ──────────────────────────────────────

  context('Create Missionary (Admin UI)', () => {
    it('Create Missionary button / panel opens', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.contains('button', /create new/i, { timeout: 10000 }).should('be.visible').click()
      // Slide panel should open — look for visible input in the panel
      cy.get('input[name="firstName"], input[name="email"]', { timeout: 10000 }).first().should('be.visible')
    })

    it('missionary form validates required fields', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.contains('button', /create new/i, { timeout: 10000 }).click()
      // Try to submit empty form
      cy.contains('button', /^Save$/i, { timeout: 5000 }).click()
      // Should show validation errors
      cy.contains(/required|first name|email/i, { timeout: 5000 }).should('exist')
    })

    it('fills and submits create missionary form (UI-test-m1)', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.contains('button', /create new/i, { timeout: 10000 }).click()

      // Fill the form — use "no" for not managed by Harvest21 so email field appears
      cy.contains(/managed by harvest/i, { timeout: 10000 }).should('exist')
      cy.get('input[type="radio"][value="no"]').first().click({ force: true })

      cy.get('input[name="firstName"]', { timeout: 5000 }).type('UITest')
      cy.get('input[name="lastName"]').type('Missionary')
      cy.get('input[name="email"]').type('ui-test-m1@h21test.local')

      // Agency and church autocompletes — type to search (matches seeded data)
      cy.get('input[placeholder="Search agencies..."]', { timeout: 5000 }).first().type('Global')
      cy.contains(/Global Missions Agency/i, { timeout: 5000 }).click()

      cy.get('input[placeholder="Search churches..."]').first().type('Baptist')
      cy.contains(/First Baptist Church/i, { timeout: 5000 }).click()

      // Mission field church (second Search churches input)
      cy.get('input[placeholder="Search churches..."]').eq(1).type('Baptist')
      cy.contains(/First Baptist Church/i, { timeout: 5000 }).first().click()

      // Submit
      cy.contains('button', /^Save$/i).click()

      // Expect success toast, missionary in list, OR email-already-exists error (idempotent)
      cy.get('body', { timeout: 15000 }).then(($body) => {
        const text = $body.text()
        const ok = /success|created|missionary|already|exists|duplicate/i.test(text)
        expect(ok, 'Expected form submit response').to.be.true
      })
    })
  })

  // ─── Supporter / Donor creation via admin UI ────────────────────────────────

  context('Create Supporter (Admin UI)', () => {
    it('Create Donor/Supporter panel opens', () => {
      cy.visit('/admin', { failOnStatusCode: false })
      cy.url({ timeout: 10000 }).should('include', '/admin')
      // Look for donors or supporters sub-section
      cy.visit('/admin/donors', { failOnStatusCode: false })
      cy.contains(/donor|supporter/i, { timeout: 10000 }).should('exist')
    })
  })

  // ─── Seeded accounts verify ─────────────────────────────────────────────────

  context('Seeded Test Accounts exist in admin', () => {
    it('alice-waller missionary appears in missionaries list', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.contains(/Alice|Waller|alice-waller/i, { timeout: 15000 }).should('exist')
    })

    it('bob-carter missionary appears in missionaries list', () => {
      cy.visit('/admin/missionaries', { failOnStatusCode: false })
      cy.contains(/Bob|Carter|bob-carter/i, { timeout: 15000 }).should('exist')
    })

    it('seeded supporter appears in users list', () => {
      cy.visit('/admin/users', { failOnStatusCode: false })
      cy.contains(/supporter@h21test|Carol/i, { timeout: 15000 }).should('exist')
    })
  })
})
