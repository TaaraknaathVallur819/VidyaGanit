---
name: Recommendation mastery weighting
description: How the "recommended next lesson" engine blends graded-test score vs. chat practice into a per-topic mastery estimate.
---

# Recommendation mastery weighting

The next-lesson recommender estimates per-topic mastery from two signals and
skips any unit at/above the mastery threshold (currently 70).

Rule: when a graded test exists for a topic, mastery is weighted strongly toward
the test (`testPct * 0.7 + activityPct * 0.3`). With no test, it falls back to
chat-practice activity alone. The low-score *reason* is decided separately from
the raw test % (a low test still surfaces the topic even if practice is high).

**Why:** an earlier version averaged the two equally (`(activity + testPct)/2`),
which meant a student who aced the test but barely chatted scored only ~50 and
kept getting re-recommended an already-mastered topic. A graded test is the
stronger signal of real understanding, so it must dominate.

**How to apply:** keep the test weight clearly above the activity weight if you
retune. Cross-check the threshold (70): with the 0.7/0.3 split, a 100% test with
zero practice lands exactly at 70 (just mastered) — lowering the test weight
would silently un-master perfect-test topics.
