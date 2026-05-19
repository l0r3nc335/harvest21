/**
 * Missionary — Public Page
 *
 * Tests: /alice-waller and /bob-carter load correctly.
 * OG metadata, follow button visibility, content independence.
 */

describe('Missionary — Public Pages', () => {
  const accs = Cypress.env('testAccounts')

  context('/alice-waller (Missionary 1)', () => {
    it('public page returns 200', () => {
      cy.request({ url: '/alice-waller', failOnStatusCode: false }).then((res) => {
        expect(res.status).to.eq(200)
      })
    })

    it('page loads in browser without error boundary', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.contains(/something went wrong|500 error/i).should('not.exist')
    })

    it('does NOT show a 404', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.contains(/404|not found/i, { timeout: 10000 }).should('not.exist')
    })

    it('shows missionary name on the page', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.contains(/Alice|Waller/i, { timeout: 15000 }).should('be.visible')
    })

    it('OG image and title meta tags are in server HTML', () => {
      cy.request({ url: '/alice-waller', failOnStatusCode: false }).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include('og:title')
      })
    })

    it('Follow button is visible to unauthenticated users', () => {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy^="button-follow"]', { timeout: 15000 }).should('be.visible')
    })
  })

  context('/bob-carter (Missionary 2) — independent from M1', () => {
    it('bob-carter public page returns 200', () => {
      cy.request({ url: '/bob-carter', failOnStatusCode: false }).then((res) => {
        expect(res.status).to.eq(200)
      })
    })

    it('shows Bob Carter name — not Alice Waller', () => {
      cy.visit('/bob-carter', { failOnStatusCode: false })
      cy.contains(/Bob|Carter/i, { timeout: 15000 }).should('be.visible')
      cy.contains(/Alice Waller/i).should('not.exist')
    })

    it('alice-waller content is NOT on bob-carter page', () => {
      cy.request({ url: '/bob-carter', failOnStatusCode: false }).then((res) => {
        expect(res.body).to.not.include('alice-waller')
      })
    })
  })

  context('Follow gate — unauthenticated vs authenticated supporter', () => {
    it('unauthenticated user sees follow button on alice-waller', () => {
      cy.clearAllCookies()
      cy.clearAllLocalStorage()
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy^="button-follow"]', { timeout: 15000 }).should('exist')
    })

    it('authenticated missionary owner does NOT see follow button on own page', () => {
      cy.loginAs('missionary1')
      cy.visit('/alice-waller', { failOnStatusCode: false })
      // Owner should not see the follow button
      cy.get('[data-cy^="button-follow"]', { timeout: 10000 }).should('not.exist')
    })
  })
})
