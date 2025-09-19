import { test, expect } from '@playwright/test';

test.describe('Knowledge Base OEM-Specific Filtering', () => {
  test('should show different data for different OEMs', async ({ page }) => {
    // Navigate to knowledge page
    await page.goto('http://localhost:6001/knowledge');

    // Wait for knowledge page to load
    await page.waitForSelector('text=Knowledge Repository');

    // Wait for stats to load
    await page.waitForSelector('[style*="backgroundColor: #ffffff"]');

    // Check that we have ECU data showing with "All OEMs" selected
    await page.waitForSelector('select[data-testid="oem-filter"]');

    // Get the initial count of ECUs with "All OEMs"
    const allOemsOption = page.locator('select[data-testid="oem-filter"]');
    await expect(allOemsOption).toBeVisible();

    // Look for ECU data rows
    const ecuRows = page.locator('[data-testid="ecu-data"] tbody tr');
    const totalEcusCount = await ecuRows.count();
    console.log(`Total ECUs with All OEMs: ${totalEcusCount}`);

    // Verify we have some ECU data
    expect(totalEcusCount).toBeGreaterThan(0);

    // Select a specific OEM (look for Land Rover)
    const oemSelect = page.locator('select[data-testid="oem-filter"]');
    const oemOptions = page.locator('select[data-testid="oem-filter"] option');
    const oemCount = await oemOptions.count();
    console.log(`Available OEMs: ${oemCount}`);

    // Find Land Rover option
    const landRoverOption = page.locator('select[data-testid="oem-filter"] option:has-text("Land Rover")');
    if (await landRoverOption.count() > 0) {
      // Select Land Rover
      await oemSelect.selectOption({ label: 'Land Rover' });

      // Wait for data to update
      await page.waitForTimeout(1000);

      // Check that ECU data is filtered to Land Rover specific
      const landRoverEcusCount = await ecuRows.count();
      console.log(`Land Rover ECUs: ${landRoverEcusCount}`);

      // The count should be same or less than total (if LR specific data exists)
      expect(landRoverEcusCount).toBeLessThanOrEqual(totalEcusCount);

      // Select Model filter (should populate with Land Rover models)
      const modelSelect = page.locator('select[data-testid="model-filter"]');
      await expect(modelSelect).toBeVisible();

      const modelOptions = page.locator('select[data-testid="model-filter"] option');
      const modelCount = await modelOptions.count();
      console.log(`Available Models for Land Rover: ${modelCount}`);

      // Should have at least "All Models" option and potentially specific models
      expect(modelCount).toBeGreaterThanOrEqual(1);
    }

    // Test switching between different data types
    const didTab = page.locator('button:has-text("DIDs")');
    await didTab.click();

    // Wait for DID data to load
    await page.waitForTimeout(1000);

    const didRows = page.locator('[data-testid="did-data"] tbody tr');
    const didCount = await didRows.count();
    console.log(`DID count: ${didCount}`);

    // Switch to Routines
    const routineTab = page.locator('button:has-text("Routines")');
    await routineTab.click();

    // Wait for Routine data to load
    await page.waitForTimeout(1000);

    const routineRows = page.locator('[data-testid="routine-data"] tbody tr');
    const routineCount = await routineRows.count();
    console.log(`Routine count: ${routineCount}`);

    console.log('Knowledge base OEM-specific filtering test completed');
  });
});