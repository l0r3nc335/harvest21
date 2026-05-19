import './commands'

// ── Global exception suppression ──────────────────────────────────────────────

Cypress.on('uncaught:exception', (err) => {
  // Vercel flags placeholder key in local env
  if (err.message.includes('Missing sdkKey') || err.message.includes('@vercel/flags')) {
    return false
  }
  // Browser quirk in headless mode
  if (err.message.includes('cannot have a negative time stamp')) {
    return false
  }
  // Supabase realtime connection noise in local dev
  if (err.message.includes('WebSocket') || err.message.includes('realtime')) {
    return false
  }
})

// ── Seed test data before entire suite ───────────────────────────────────────

before(() => {
  cy.task('seedTestAccounts').then((result) => {
    cy.task('log', `Seed result: ${JSON.stringify(result)}`)
  })
})
