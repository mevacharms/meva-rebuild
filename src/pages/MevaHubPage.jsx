const handleClaim = async () => {
  try {
    setActionLoading(true);
    setActionMessage("");
    setAuthMessage("");
    await trackInteraction("claim_click");

    if (!user) {
      const signInResult = await beginGoogleSignIn("claim");

      if (signInResult?.mode === "redirect") {
        return;
      }

      if (signInResult?.mode === "failed") {
        return;
      }

      if (signInResult?.mode === "popup" && signInResult.user) {
        await syncUserProfile();
        await claimMeva({ mevaId });
        await refreshCurrentMeva();
        clearPendingAction();
        setAuthMessage("");
        setActionMessage("Signed in and claimed.");
        return;
      }

      return;
    }

    await claimMeva({ mevaId });
    await refreshCurrentMeva();
    setAuthMessage("");
    setActionMessage("This Meva is now claimed.");
  } catch (err) {
    console.error("Claim failed:", err);
    setActionMessage(err?.message || "We couldn’t claim this Meva right now.");
  } finally {
    setActionLoading(false);
  }
};