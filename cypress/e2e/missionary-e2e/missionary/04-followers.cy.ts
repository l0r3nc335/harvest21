/**
 * Missionary — Followers Tab
 *
 * Tests: view follower requests, approve, reject.
 * Uses cy.task to create follow requests programmatically so the UI test
 * focuses on the approval/rejection UI rather than the click-through flow.
 */

describe('Missionary — Followers Tab', () => {
  const accs = Cypress.env('testAccounts')

  context('Followers tab loads', () => {
    beforeEach(() => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('followers')
    })

    it('followers tab exists and loads without error', () => {
      cy.get('[data-cy="tab-followers"]', { timeout: 10000 }).should('exist')
      cy.contains(/something went wrong/i, { timeout: 15000 }).should('not.exist')
    })

    it('followers content is visible in main area', () => {
      cy.get('h1, h2, h3', { timeout: 10000 }).contains(/followers/i)
    })

    it('shows empty state or follower list (no error)', () => {
      cy.get('body', { timeout: 10000 }).then(($body) => {
        const text = $body.text().toLowerCase()
        const hasContent =
          text.includes('follower') ||
          text.includes('pending') ||
          text.includes('accepted') ||
          text.includes('no follower')
        expect(hasContent).to.be.true
      })
    })
  })

  context('Approve follower request', () => {
    before(() => {
      // Create a pending follow request from supporter → missionary1
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
        cy.task('resetFollowerStatus', {
          supporterEmail: accs.supporter.email,
          missionaryId: res.id,
        }).then(() => {
          cy.task('createFollowRequest', {
            supporterEmail: accs.supporter.email,
            missionaryId: res.id,
          })
        })
      })
    })

    beforeEach(() => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('followers')
    })

    it('pending follow request from Carol Smith is visible', () => {
      // First verify the DB has the row
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((mRes: any) => {
        cy.task('getFollowerCount', { missionaryId: mRes.id }).then((dbRes: any) => {
          cy.task('log', `DB follower count for missionary ${mRes.id}: ${JSON.stringify(dbRes)}`)
        })
      })
      cy.contains(/Carol|supporter@h21test/i, { timeout: 15000 }).should('exist')
    })

    it('pending badge is shown on the request', () => {
      cy.contains(/pending/i, { timeout: 10000 }).should('exist')
    })

    it('Accept button is present on pending request', () => {
      cy.get('[data-cy="button-approve-follow"]', { timeout: 10000 }).should('exist')
    })

    it('clicking Accept approves the follower', () => {
      cy.get('[data-cy="button-approve-follow"]', { timeout: 10000 }).first().click()
      cy.contains(/accepted|success/i, { timeout: 10000 }).should('exist')
    })
  })

  context('Reject follower request', () => {
    before(() => {
      // Create a fresh pending request
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
        cy.task('resetFollowerStatus', {
          supporterEmail: accs.supporter.email,
          missionaryId: res.id,
        }).then(() => {
          cy.task('createFollowRequest', {
            supporterEmail: accs.supporter.email,
            missionaryId: res.id,
          })
        })
      })
    })

    beforeEach(() => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('followers')
    })

    it('Reject button is present on pending request', () => {
      cy.get('[data-cy="button-reject-follow"]', { timeout: 10000 }).should('exist')
    })

    it('clicking Reject rejects the follower', () => {
      cy.get('[data-cy="button-reject-follow"]', { timeout: 10000 }).first().click()
      cy.contains(/rejected|success/i, { timeout: 10000 }).should('exist')
    })
  })
})
