// ── Custom command type declarations ─────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      loginAs(role: 'missionary1' | 'missionary2' | 'supporter' | 'church' | 'agency' | 'admin'): Chainable<void>
      navigateToSettingsTab(tabId: string): Chainable<void>
      getMailpitEmail(to: string): Chainable<{ ID: string; Subject: string } | null>
    }
  }
}

// ── cy.login ─────────────────────────────────────────────────────────────────

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.visit('/login', { failOnStatusCode: false })
      cy.get('[data-cy="input-email"]', { timeout: 10000 }).clear().type(email)
      cy.get('[data-cy="input-password"]').clear().type(password)
      cy.get('[data-cy="button-sign-in"]').click()
      cy.url({ timeout: 20000 }).should('not.include', '/login')
    },
    { cacheAcrossSpecs: true }
  )
})

// ── cy.loginAs ───────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAs', (role) => {
  const accounts = Cypress.env('testAccounts') as Record<string, { email: string; password: string }>
  const acc = accounts[role]
  if (!acc) throw new Error(`Unknown role: ${role}`)
  cy.login(acc.email, acc.password)
})

// ── cy.navigateToSettingsTab ──────────────────────────────────────────────────

Cypress.Commands.add('navigateToSettingsTab', (tabId: string) => {
  cy.visit('/settings', { failOnStatusCode: false })
  // Sidebar tabs may be inside a position:fixed container — use exist + force
  cy.get('[data-cy="tab-account"]', { timeout: 15000 }).should('exist')
  if (tabId !== 'account') {
    cy.get(`[data-cy="tab-${tabId}"]`, { timeout: 10000 }).scrollIntoView().click({ force: true })
  }
})

// ── cy.getMailpitEmail ────────────────────────────────────────────────────────

Cypress.Commands.add('getMailpitEmail', (to: string) => {
  return cy.task('getMailpitEmail', { to }) as Cypress.Chainable<{ ID: string; Subject: string } | null>
})

export {}
