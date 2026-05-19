/**
 * Cross-Missionary — Independence Verification
 *
 * Verifies that M1 and M2 are truly independent:
 * - Different page URLs, names, content
 * - Follower counts are independent
 * - Supporter following M1 does not automatically follow M2
 */

describe('Cross-Missionary — Independence', () => {
  const accs = Cypress.env('testAccounts')
  let missionary1Id: number
  let missionary2Id: number

  before(() => {
    cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
      missionary1Id = res.id
    })
    cy.task('getMissionaryId', { email: accs.missionary2.email }).then((res: any) => {
      missionary2Id = res.id
    })
  })

  context('Public pages are distinct', () => {
    it('/alice-waller and /bob-carter both return 200', () => {
      cy.request({ url: '/alice-waller', failOnStatusCode: false }).its('status').should('eq', 200)
      cy.request({ url: '/bob-carter', failOnStatusCode: false }).its('status').should('eq', 200)
    })

    it('alice-waller page contains Alice — not Bob', () => {
      cy.request({ url: '/alice-waller', failOnStatusCode: false }).then((res) => {
        expect(res.body.toLowerCase()).to.include('alice')
        expect(res.body.toLowerCase()).to.not.include('bob carter')
      })
    })

    it('bob-carter page contains Bob — not Alice', () => {
      cy.request({ url: '/bob-carter', failOnStatusCode: false }).then((res) => {
        expect(res.body.toLowerCase()).to.include('bob')
        expect(res.body.toLowerCase()).to.not.include('alice waller')
      })
    })

    it('alice-waller OG title does NOT reference bob-carter', () => {
      cy.request({ url: '/alice-waller', failOnStatusCode: false }).then((res) => {
        expect(res.body).to.not.include('bob-carter')
      })
    })
  })

  context('Settings are independent per missionary', () => {
    it('M1 page-details shows alice-waller URL', () => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('page-details')
      cy.get('input[placeholder="page-url"]', { timeout: 10000 }).should('have.value', 'alice-waller')
    })

    it('M2 page-details shows bob-carter URL — not alice-waller', () => {
      cy.loginAs('missionary2')
      cy.navigateToSettingsTab('page-details')
      cy.get('input[placeholder="page-url"]', { timeout: 10000 }).should('have.value', 'bob-carter')
    })
  })

  context('Follower relationships are independent', () => {
    before(() => {
      // Ensure supporter is accepted follower of M1 but NOT M2
      cy.task('resetFollowerStatus', {
        supporterEmail: accs.supporter.email,
        missionaryId: missionary1Id,
      }).then(() => {
        cy.task('createFollowRequest', {
          supporterEmail: accs.supporter.email,
          missionaryId: missionary1Id,
        }).then((follow: any) => {
          cy.task('acceptFollowRequest', { followId: follow.followId })
        })
      })
      cy.task('resetFollowerStatus', {
        supporterEmail: accs.supporter.email,
        missionaryId: missionary2Id,
      })
    })

    it('supporter following M1 is NOT automatically following M2', () => {
      cy.loginAs('supporter')
      cy.visit('/bob-carter', { failOnStatusCode: false })
      // Should show Follow (none) or Pending — NOT Following (accepted)
      cy.get('[data-cy="button-follow-accepted"]', { timeout: 10000 }).should('not.exist')
      cy.get('[data-cy="button-follow-none"], [data-cy="button-follow-pending"]').should('exist')
    })

    it('M1 followers tab has Carol Smith — M2 followers tab does not', () => {
      // Check M1 has Carol
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('followers')
      cy.contains(/Carol|supporter@h21test/i, { timeout: 15000 }).should('exist')

      // Check M2 does NOT have Carol
      cy.loginAs('missionary2')
      cy.navigateToSettingsTab('followers')
      // Carol should not appear — either empty state or list without Carol
      cy.get('body', { timeout: 10000 }).then(($body) => {
        // If list exists, Carol should not be in it
        const list = $body.find('[data-cy="list-follower-requests"]')
        if (list.length > 0) {
          expect(list.text()).to.not.include('Carol')
        }
        // Otherwise, empty state = no Carol following M2 ✓
      })
    })
  })
})
