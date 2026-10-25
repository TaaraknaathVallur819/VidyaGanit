// Navigation triggers this once while a visitor reads or fills in the form.
// No recurring requests keep an idle service awake.
let preparation: Promise<void> | undefined;
let preparedAt = 0;

export function prepareApi(): Promise<void> {
  if (preparation) return preparation;
  if (preparedAt && Date.now() - preparedAt < 5 * 60_000)
    return Promise.resolve();
  const baseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
  preparation = fetch(`${baseUrl}/api/readyz`, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  })
    .then((response) => {
      if (response.ok) preparedAt = Date.now();
    })
    .catch(() => {
      /* Registration still works if preparation fails. */
    })
    .finally(() => {
      preparation = undefined;
    });
  return preparation;
}
