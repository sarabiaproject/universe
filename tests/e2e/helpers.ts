import { expect, type Page } from "@playwright/test";

/**
 * "Acciones del mapa" → "Nuevo mapa", and wait until the menu is really done.
 *
 * The Radix menu animates out, unmounts, and only then gives focus back to its trigger
 * (FocusScope does it in a `setTimeout` on unmount). Anything a test focuses before that,
 * a button or a canvas node, loses focus to the "⋯" button a few ms later, and the next
 * Enter, arrow or Delete lands on the menu instead. Waiting for that last step removes
 * the race; it was the cause of the flaky "keyboard: create, move, delete and undo".
 */
export async function newMapFromMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "Acciones del mapa" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Nuevo mapa" }).click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
}
