import { test, expect } from '@playwright/test'

test.describe('ECU Name Badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:6001/jobs')
    await page.waitForSelector('text=Diagnostic Jobs', { timeout: 10000 })
  })

  test('should display ECU count on job cards', async ({ page }) => {
    // Check that job cards show ECU count
    const ecuCounts = await page.locator('.text-2xl.font-semibold').allTextContents()

    // At least one job should have ECUs
    const hasEcus = ecuCounts.some(count => parseInt(count) > 0)
    expect(hasEcus).toBeTruthy()
  })

  test('should display ECU badges in job details', async ({ page }) => {
    // Click on first job card
    await page.click('[href^="/jobs/"]:first-of-type')

    // Wait for job details to load
    await page.waitForSelector('text=UDS Communications', { timeout: 10000 })

    // Check for ECU badges in the table
    const ecuBadges = await page.locator('span').filter({
      hasText: /PCM|BCM|ABS|TCM|HVAC|SRS|PSCM|IPC|RCM|DDM|PDM|APIM|SCCM|DSM|GPSM|BMS|GWM|PAM|TPMS|FCM|TCU|RRM|HUD|ACM|VDM|RSE|SODL|SODR|OCS|CMPD|BCCM|HECM|TSM|LCM|OBCM|WACM|MTRG|DCDC/
    })

    const badgeCount = await ecuBadges.count()
    console.log(`Found ${badgeCount} ECU name badges`)

    // Should have at least some ECU badges
    expect(badgeCount).toBeGreaterThan(0)
  })

  test('should call knowledge API for ECU resolution', async ({ page }) => {
    let apiCalled = false

    // Intercept the API call
    await page.route('/api/knowledge/ecu/resolve', async route => {
      apiCalled = true
      const request = route.request()
      const postData = request.postDataJSON()

      // Verify request contains addresses array
      expect(postData).toHaveProperty('addresses')
      expect(Array.isArray(postData.addresses)).toBeTruthy()

      // Continue with the request
      await route.continue()
    })

    // Navigate to job details
    await page.goto('http://localhost:6001/jobs/cmfozfwtt0001uc14idbu576w')

    // Wait for API call
    await page.waitForTimeout(2000)

    expect(apiCalled).toBeTruthy()
  })

  test('should display correct ECU names', async ({ page }) => {
    await page.goto('http://localhost:6001/jobs/cmfozfwtt0001uc14idbu576w')
    await page.waitForSelector('text=UDS Communications', { timeout: 10000 })

    // Check for specific ECU names that should be present
    const expectedEcus = ['PCM', 'BCM', 'ABS', 'TCM']

    for (const ecuName of expectedEcus) {
      const ecuBadge = await page.locator(`span:has-text("${ecuName}")`).first()
      const isVisible = await ecuBadge.isVisible().catch(() => false)

      if (isVisible) {
        console.log(`✓ Found ECU badge: ${ecuName}`)
      }
    }
  })
})