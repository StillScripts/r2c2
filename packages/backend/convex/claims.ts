/** Whether a publish, deploy or rollback still holds what it claimed. */
export const isActive = (claim: { expiresAt: number }) =>
  claim.expiresAt > Date.now()

/** Run `work` while holding a claim, letting it go with `release` however `work` ends. */
export async function whileClaimed<T>(
  release: () => Promise<unknown>,
  work: () => Promise<T>
) {
  try {
    return await work()
  } finally {
    await release()
  }
}
