/**
 * Missionary Settings — Account Tab
 *
 * Tests: Profile info display, name update, email display, account save.
 * Missionary 1: Alice Waller (m1@h21test.local)
 */

describe('Missionary — Settings: Account Tab', () => {
  const accs = Cypress.env('testAccounts')

  beforeEach(() => {
    cy.loginAs('missionary1')
    cy.navigateToSettingsTab('account')
  })

  it('settings page loads without error boundary', () => {
    cy.contains(/something went wrong|error/i, { timeout: 15000 }).should('not.exist')
    cy.get('[data-cy="tab-account"]', { timeout: 10000 }).should('exist')
  })

  it('all settings tabs are visible', () => {
    cy.get('[data-cy="tab-account"]').should('exist')
    cy.get('[data-cy="tab-page-details"]').should('exist')
    cy.get('[data-cy="tab-followers"]').should('exist')
    cy.get('[data-cy="tab-security"]').should('exist')
  })

  it('account tab shows Alice Waller name fields', () => {
    cy.get('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]', { timeout: 10000 })
      .first()
      .should('have.value', 'Alice')
    cy.get('input[name="lastName"], input[id="lastName"], input[placeholder*="last" i]')
      .first()
      .should('have.value', 'Waller')
  })

  it('email field is visible and pre-filled with missionary email', () => {
    // Email may be in an input value or text element
    cy.get('body', { timeout: 10000 }).then(($body) => {
      const hasEmail = $body.text().includes(accs.missionary1.email) ||
        $body.find(`input[value="${accs.missionary1.email}"]`).length > 0 ||
        $body
          .find(`input`)
          .toArray()
          .some((el) => el instanceof HTMLInputElement && el.value === accs.missionary1.email)
      expect(hasEmail, `Should find ${accs.missionary1.email} on page`).to.be.true
    })
  })

  it('Save Changes button is present on account tab', () => {
    cy.get('[data-cy="button-save-account"]', { timeout: 10000 }).should('exist')
  })

  it('can update and save a name change (then revert)', () => {
    const newFirstName = 'AliceUpdated'
    cy.get('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]')
      .first()
      .clear()
      .type(newFirstName)
    cy.get('[data-cy="button-save-account"]').click()
    cy.contains(/saved|success/i, { timeout: 10000 }).should('exist')
    // Wait for first toast to disappear so revert save can be detected independently
    cy.contains(/saved|success/i, { timeout: 10000 }).should('not.exist')

    // Revert — must complete fully so page URL slug is restored to alice-waller
    cy.get('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]')
      .first()
      .clear()
      .type('Alice')
    cy.get('[data-cy="button-save-account"]').click()
    cy.contains(/saved|success/i, { timeout: 10000 }).should('exist')
    // Wait for revert save to fully complete before proceeding
    cy.contains(/saved|success/i, { timeout: 10000 }).should('not.exist')
  })

  it('security tab shows password change fields', () => {
    cy.get('[data-cy="tab-security"]').click({ force: true })
    cy.get('[data-cy="input-currentPassword"]', { timeout: 10000 }).should('exist')
    cy.get('[data-cy="input-newPassword"]').should('exist')
    cy.get('[data-cy="button-save-security"]').should('exist')
  })

  it('security tab — wrong current password shows error', () => {
    cy.get('[data-cy="tab-security"]').click({ force: true })
    cy.get('[data-cy="input-currentPassword"]', { timeout: 10000 }).type('WrongPass999!')
    cy.get('[data-cy="input-newPassword"]').type('NewPass123!')
    cy.get('input[placeholder*="confirm" i]').type('NewPass123!')
    cy.get('[data-cy="button-save-security"]').click()
    cy.contains(/incorrect|wrong|invalid/i, { timeout: 10000 }).should('exist')
  })

  it('missionary2 settings show Bob Carter — not Alice', () => {
    cy.loginAs('missionary2')
    cy.navigateToSettingsTab('account')
    cy.get('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]')
      .first()
      .should('have.value', 'Bob')
  })
})
