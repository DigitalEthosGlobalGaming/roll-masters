/** Font failure must never prevent engine startup. Late loads invalidate root widgets. */
export async function waitForFontLoad(font: string, timeout = 2000, fonts: Pick<FontFaceSet, "load"> = document.fonts): Promise<boolean> {
  if (!fonts) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fonts.load(font).then(() => true, () => false),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeout); })
    ]);
  } catch { return false; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
