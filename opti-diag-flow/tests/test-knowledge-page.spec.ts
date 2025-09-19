import { test, expect } from '@playwright/test'

test.describe('Knowledge Page', () => {
  test('should load with proper CSS formatting', async ({ page }) => {
    await page.goto('http://localhost:6001/knowledge')

    // Wait for the page to load
    await page.waitForSelector('text=Knowledge Repository', { timeout: 10000 })

    // Check for basic page elements
    const title = await page.locator('text=Knowledge Repository')
    expect(await title.isVisible()).toBeTruthy()

    // Check for tab buttons
    const ecuTab = await page.locator('text=ECUs')
    const didTab = await page.locator('text=DIDs')
    const dtcTab = await page.locator('text=DTCs')
    const routineTab = await page.locator('text=Routines')

    expect(await ecuTab.isVisible()).toBeTruthy()
    expect(await didTab.isVisible()).toBeTruthy()
    expect(await dtcTab.isVisible()).toBeTruthy()
    expect(await routineTab.isVisible()).toBeTruthy()

    // Check for hierarchy level dropdown
    const hierarchySelect = await page.locator('select').first()
    expect(await hierarchySelect.isVisible()).toBeTruthy()

    // Check for table
    const table = await page.locator('table')
    expect(await table.isVisible()).toBeTruthy()

    // Check for table headers
    const addressHeader = await page.locator('th:has-text("Address")').first()
    const nameHeader = await page.locator('th:has-text("Name")').first()

    expect(await addressHeader.isVisible()).toBeTruthy()
    expect(await nameHeader.isVisible()).toBeTruthy()

    // Test dropdown functionality - dropdowns should not be transparent
    const selectElements = await page.locator('select').all()
    console.log(`Found ${selectElements.length} select dropdowns`)

    for (const select of selectElements) {
      const bgColor = await select.evaluate(el => window.getComputedStyle(el).backgroundColor)
      console.log('Select background color:', bgColor)
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(bgColor).not.toBe('transparent')
    }

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'knowledge-page.png', fullPage: true })
    console.log('Screenshot saved as knowledge-page.png')
  })

  test('should have dark mode styling', async ({ page }) => {
    await page.goto('http://localhost:6001/knowledge')

    // Check if dark mode classes are applied
    const html = await page.locator('html')
    const classList = await html.getAttribute('class')
    console.log('HTML classes:', classList)

    // Check background color of body
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })
    console.log('Body background:', bodyBg)
  })
})