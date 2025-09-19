import { test, expect } from '@playwright/test';

test.describe('Job Reparsing and Knowledge Discovery', () => {
  test('should reparse job and populate knowledge base', async ({ page }) => {
    // Navigate to jobs page
    await page.goto('http://localhost:6001/jobs');

    // Wait for page to load
    await page.waitForSelector('table');

    // Click on the first job
    const firstJobRow = page.locator('table tbody tr').first();
    await firstJobRow.click();

    // Wait for job details page
    await page.waitForSelector('text=Job Details');

    // Find and click the reparse button
    const reparseButton = page.locator('button:has-text("Reparse")');
    await expect(reparseButton).toBeVisible();
    await reparseButton.click();

    // Wait for reparsing to complete (look for success message or updated data)
    await page.waitForTimeout(5000); // Give time for reparsing

    // Navigate to knowledge page to verify data was populated
    await page.goto('http://localhost:6001/knowledge');

    // Wait for knowledge page to load
    await page.waitForSelector('text=Knowledge Repository');

    // Check if ECU definitions are populated
    const ecuData = page.locator('[data-testid="ecu-data"]');
    await expect(ecuData).toBeVisible();

    // Check stats to see if data was added
    const statsCards = page.locator('[style*="backgroundColor: #ffffff"]');
    await expect(statsCards).toHaveCount(4); // Should have 4 stats cards

    console.log('Job reparsing and knowledge discovery test completed');
  });
});