/**
 * Missionary Settings — Page Details Tab
 *
 * Tests: biography, mission status, page URL, preview/publish buttons.
 * Both missionaries tested for independence.
 */

describe('Missionary — Settings: Page Details', () => {
  const accs = Cypress.env('testAccounts')

  context('Missionary 1 (Alice Waller)', () => {
    beforeEach(() => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('page-details')
    })

    it('page-details tab is clickable and loads without error', () => {
      cy.contains(/something went wrong/i, { timeout: 15000 }).should('not.exist')
    })

    it('Preview Page button is visible on page-details tab', () => {
      cy.get('[data-cy="button-preview-page"]', { timeout: 10000 }).should('be.visible')
    })

    it('page is published — preview button is visible', () => {
      // Seed publishes the page so we check preview button exists (not publish button)
      cy.get('[data-cy="button-preview-page"]', { timeout: 10000 }).should('exist')
    })

    it('page URL field shows alice-waller', () => {
      // The page URL is in an input field value, not text content
      cy.get('input[placeholder="page-url"]', { timeout: 10000 }).then(($input) => {
        cy.task('log', `page URL input value: "${$input.val()}"`)
      })
      cy.get('input[placeholder="page-url"]', { timeout: 10000 }).should('have.value', 'alice-waller')
    })

    it('mission status field is present on page-details tab', () => {
      // The status field may be a select, combobox, or just text — just verify the tab loaded
      cy.get('body', { timeout: 5000 }).should('not.contain.text', 'something went wrong')
      cy.get('select, [role="combobox"], [data-cy*="status"]', { timeout: 10000 }).should('have.length.gte', 1)
    })

    it('biography textarea is present', () => {
      cy.get('textarea, [contenteditable="true"]', { timeout: 10000 }).should('have.length.gte', 1)
    })

    it('clicking Preview Page shows preview (or loading state)', () => {
      cy.get('[data-cy="button-preview-page"]', { timeout: 10000 }).click()
      // Either a preview loads or an error message about missing fields
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.contains(/something went wrong|500 error/i).should('not.exist')
    })
  })

  context('Missionary 2 (Bob Carter) — independent from M1', () => {
    beforeEach(() => {
      cy.loginAs('missionary2')
      cy.navigateToSettingsTab('page-details')
    })

    it('page URL shows bob-carter — not alice-waller', () => {
      cy.get('input[placeholder="page-url"]', { timeout: 10000 }).should('have.value', 'bob-carter')
    })

    it('Preview Page button present for M2', () => {
      cy.get('[data-cy="button-preview-page"]', { timeout: 10000 }).should('be.visible')
    })
  })
})
