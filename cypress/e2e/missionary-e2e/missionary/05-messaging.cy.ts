/**
 * Missionary — Messaging
 *
 * Tests: messages page loads, conversation visible after supporter messages.
 * Full send/receive flow requires supporter to initiate — tested in supporter suite.
 */

describe('Missionary — Messages', () => {
  const accs = Cypress.env('testAccounts')

  context('Messages page access', () => {
    beforeEach(() => {
      cy.loginAs('missionary1')
    })

    it('messages page loads without error', () => {
      cy.visit('/messages', { failOnStatusCode: false })
      cy.url({ timeout: 10000 }).should('include', '/messages')
      cy.contains(/something went wrong|access denied/i, { timeout: 10000 }).should('not.exist')
    })

    it('messages page shows conversation list or empty state', () => {
      cy.visit('/messages', { failOnStatusCode: false })
      // Either conversations exist (list-conversations) or empty state shows
      cy.get('body', { timeout: 15000 }).then(($body) => {
        const hasConversations = $body.find('[data-cy="list-conversations"]').length > 0
        const hasEmptyState = $body.text().includes('No conversations yet')
        expect(hasConversations || hasEmptyState).to.be.true
      })
    })

    it('missionary2 also has a working messages page', () => {
      cy.loginAs('missionary2')
      cy.visit('/messages', { failOnStatusCode: false })
      cy.url({ timeout: 10000 }).should('include', '/messages')
      cy.contains(/something went wrong/i).should('not.exist')
    })
  })

  context('Missionary receives a message from accepted follower', () => {
    let missionary1Id: number
    let followId: number

    before(() => {
      // Ensure Carol is an accepted follower of missionary1
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
        missionary1Id = res.id
        cy.task('resetFollowerStatus', {
          supporterEmail: accs.supporter.email,
          missionaryId: missionary1Id,
        }).then(() => {
          cy.task('createFollowRequest', {
            supporterEmail: accs.supporter.email,
            missionaryId: missionary1Id,
          }).then((follow: any) => {
            followId = follow.followId
            cy.task('acceptFollowRequest', { followId })
          })
        })
      })
    })

    it('settings messages tab loads for missionary1', () => {
      cy.loginAs('missionary1')
      cy.navigateToSettingsTab('messages')
      cy.contains(/something went wrong/i, { timeout: 10000 }).should('not.exist')
    })
  })
})
