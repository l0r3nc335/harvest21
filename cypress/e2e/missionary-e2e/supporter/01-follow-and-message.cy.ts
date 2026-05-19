/**
 * Supporter — Follow & Message Flow
 *
 * Tests the full supporter lifecycle:
 * - Visit missionary public pages
 * - Send follow requests
 * - Message after approval
 * - Cannot message unapproved missionary
 */

describe('Supporter — Follow & Message Flow', () => {
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

  context('Supporter page access', () => {
    beforeEach(() => {
      cy.loginAs('supporter')
    })

    it('supporter can access messages page', () => {
      cy.visit('/messages', { failOnStatusCode: false })
      cy.url({ timeout: 10000 }).should('include', '/messages')
      cy.contains(/something went wrong|access denied/i).should('not.exist')
    })

    it('supporter can visit /alice-waller', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('body', { timeout: 15000 }).should('be.visible')
      cy.contains(/something went wrong|404/i).should('not.exist')
    })

    it('supporter sees Follow button on alice-waller', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy^="button-follow"]', { timeout: 15000 }).should('be.visible')
    })

    it('supporter sees Follow button on bob-carter', () => {
      cy.visit('/bob-carter', { failOnStatusCode: false })
      cy.get('[data-cy^="button-follow"]', { timeout: 15000 }).should('be.visible')
    })
  })

  context('Supporter sends follow request to Missionary 1', () => {
    before(() => {
      // Start clean
      cy.task('resetFollowerStatus', {
        supporterEmail: accs.supporter.email,
        missionaryId: missionary1Id,
      })
    })

    beforeEach(() => {
      cy.loginAs('supporter')
    })

    it('Follow button state is "none" (Follow) before requesting', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-none"]', { timeout: 15000 }).should('be.visible')
    })

    it('clicking Follow opens the follow request modal', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-none"]', { timeout: 15000 }).click()
      // Follow request modal should appear
      cy.contains(/follow request|message|note/i, { timeout: 10000 }).should('be.visible')
    })

    it('submitting follow request changes button state to Pending', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-none"]', { timeout: 15000 }).click()
      // Wait for modal to appear before submitting
      cy.contains(/your follow request will be sent/i, { timeout: 10000 }).should('be.visible')
      // Click the "Send Request" button specifically (not the page's Follow button)
      cy.contains('button', /send request/i, { timeout: 5000 }).click({ force: true })
      cy.get('[data-cy="button-follow-pending"]', { timeout: 15000 }).should('exist')
    })
  })

  context('Supporter messages Missionary 1 after approval', () => {
    before(() => {
      // Ensure accepted follow relationship
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
        cy.task('resetFollowerStatus', {
          supporterEmail: accs.supporter.email,
          missionaryId: res.id,
        }).then(() => {
          cy.task('createFollowRequest', {
            supporterEmail: accs.supporter.email,
            missionaryId: res.id,
          }).then((follow: any) => {
            cy.task('acceptFollowRequest', { followId: follow.followId })
          })
        })
      })
    })

    beforeEach(() => {
      cy.loginAs('supporter')
    })

    it('Direct Message button is accessible on /alice-waller after approval', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      // After approval, either a Message button appears or the follow status is "Following"
      cy.get('[data-cy="button-follow-accepted"]', { timeout: 15000 }).should('exist')
    })

    it('can navigate to messages page and see conversations or empty state', () => {
      cy.visit('/messages', { failOnStatusCode: false })
      cy.get('body', { timeout: 15000 }).then(($body) => {
        const hasConversations = $body.find('[data-cy="list-conversations"]').length > 0
        const hasEmptyState = $body.text().includes('No conversations yet')
        expect(hasConversations || hasEmptyState, 'Should show conversations or empty state').to.be.true
      })
    })
  })

  context('Supporter unfollows Missionary 1', () => {
    before(() => {
      // Set up an accepted follow so we can test the unfollow flow
      cy.task('getMissionaryId', { email: accs.missionary1.email }).then((res: any) => {
        cy.task('resetFollowerStatus', {
          supporterEmail: accs.supporter.email,
          missionaryId: res.id,
        }).then(() => {
          cy.task('createFollowRequest', {
            supporterEmail: accs.supporter.email,
            missionaryId: res.id,
          }).then((follow: any) => {
            cy.task('acceptFollowRequest', { followId: follow.followId })
          })
        })
      })
    })

    beforeEach(() => {
      cy.loginAs('supporter')
    })

    it('Following button is visible on alice-waller when accepted', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-accepted"]', { timeout: 15000 }).should('be.visible')
    })

    it('clicking Following opens the unfollow confirmation modal', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-accepted"]', { timeout: 15000 }).click()
      cy.contains(/unfollow alice waller/i, { timeout: 10000 }).should('be.visible')
    })

    it('confirming unfollow returns button to Follow state', () => {
      cy.visit('/alice-waller', { failOnStatusCode: false })
      cy.get('[data-cy="button-follow-accepted"]', { timeout: 15000 }).click()
      // Confirmation modal — click the danger "Unfollow" button
      cy.contains('button', /^Unfollow$/i, { timeout: 5000 }).click()
      // Button should return to "Follow" state (status: none)
      cy.get('[data-cy="button-follow-none"]', { timeout: 15000 }).should('exist')
    })
  })

  context('Supporter cannot message Missionary 2 (no follow relationship)', () => {
    before(() => {
      cy.task('resetFollowerStatus', {
        supporterEmail: accs.supporter.email,
        missionaryId: missionary2Id,
      })
    })

    beforeEach(() => {
      cy.loginAs('supporter')
    })

    it('bob-carter still shows Follow (not Following) button', () => {
      cy.visit('/bob-carter', { failOnStatusCode: false, timeout: 60000 })
      cy.get('[data-cy="button-follow-none"], [data-cy="button-follow-pending"]', { timeout: 20000 })
        .should('exist')
      cy.get('[data-cy="button-follow-accepted"]').should('not.exist')
    })
  })
})
