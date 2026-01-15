import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, locale = "en-US") {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`
}

export function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number")
  if (valid.length === 0) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function median(values: Array<number | null | undefined>) {
  const valid = values
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)
  if (valid.length === 0) return 0
  const mid = Math.floor(valid.length / 2)
  return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid]
}

export function percentile(values: Array<number | null | undefined>, percentileValue: number) {
  const valid = values
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b)
  if (valid.length === 0) return 0
  const index = Math.min(valid.length - 1, Math.max(0, Math.round((percentileValue / 100) * (valid.length - 1))))
  return valid[index]
}

export function standardDeviation(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number")
  if (valid.length === 0) return 0
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length
  return Math.sqrt(variance)
}

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

type HighlightReply = {
  username?: string
  is_premium?: boolean
  follower_count?: number | null
  weighted_score?: number | null
  goal_relevance?: number | null
  actionability?: number | null
  specificity?: number | null
  substantiveness?: number | null
  constructiveness?: number | null
  tags?: Array<string> | null
  tweet_created_at?: string | null
}

type HighlightReport = {
  status?: string | null
  summary_status?: string | null
  reply_count?: number | null
  useful_count?: number | null
}

export function buildReportHighlights(report: HighlightReport, replies: HighlightReply[]) {
  const isComplete = report.status === "completed" && report.summary_status === "completed"
  const totalReplies = report.reply_count ?? replies.length
  const qualifiedReplies = replies.length
  const usefulReplies = report.useful_count ?? 0

  const signalRate = totalReplies > 0 ? qualifiedReplies / totalReplies : 0
  const usefulRate = totalReplies > 0 ? usefulReplies / totalReplies : 0

  const avgScore = average(replies.map((reply) => reply.weighted_score))
  const medianScore = median(replies.map((reply) => reply.weighted_score))
  const signalScore = avgScore > 0 ? Math.round(avgScore * 0.7 + signalRate * 100 * 0.3) : 0
  const scoreStdDev = standardDeviation(replies.map((reply) => reply.weighted_score))
  const p10 = percentile(replies.map((reply) => reply.weighted_score), 10)
  const p90 = percentile(replies.map((reply) => reply.weighted_score), 90)
  const scoreSpread = Math.round(Math.max(0, p90 - p10))

  const scoreAverages = {
    goal_relevance: Math.round(average(replies.map((reply) => reply.goal_relevance))),
    actionability: Math.round(average(replies.map((reply) => reply.actionability))),
    specificity: Math.round(average(replies.map((reply) => reply.specificity))),
    substantiveness: Math.round(average(replies.map((reply) => reply.substantiveness))),
    constructiveness: Math.round(average(replies.map((reply) => reply.constructiveness))),
  }

  const tagCounts = new Map<string, number>()
  for (const reply of replies) {
    for (const tag of reply.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const contributorMap = new Map<
    string,
    {
      username: string
      follower_count: number
      is_premium: boolean
      count: number
      totalScore: number
      topScore: number
    }
  >()
  for (const reply of replies) {
    const key = reply.username
    if (!key) continue
    const entry = contributorMap.get(key) ?? {
      username: key,
      follower_count: reply.follower_count ?? 0,
      is_premium: reply.is_premium ?? false,
      count: 0,
      totalScore: 0,
      topScore: 0,
    }
    entry.count += 1
    if (typeof reply.weighted_score === "number") {
      entry.totalScore += reply.weighted_score
      entry.topScore = Math.max(entry.topScore, reply.weighted_score)
    }
    entry.follower_count = Math.max(entry.follower_count, reply.follower_count ?? 0)
    entry.is_premium = entry.is_premium || !!reply.is_premium
    contributorMap.set(key, entry)
  }
  const topContributors = Array.from(contributorMap.values())
    .map((entry) => ({
      ...entry,
      avgScore: entry.count > 0 ? Math.round(entry.totalScore / entry.count) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)

  const hiddenGems = replies
    .filter((reply) => (reply.follower_count ?? 0) <= 2000 && (reply.weighted_score ?? 0) >= 85)
    .sort((a, b) => (b.weighted_score ?? 0) - (a.weighted_score ?? 0))
    .slice(0, 3)

  const replyDates = replies
    .map((reply) => reply.tweet_created_at)
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date).getTime())
    .sort((a, b) => a - b)
  const activeWindow =
    replyDates.length >= 2 ? formatDuration(replyDates[replyDates.length - 1] - replyDates[0]) : null
  const repliesPerHour =
    replyDates.length >= 2
      ? Math.round(qualifiedReplies / Math.max(1, (replyDates[replyDates.length - 1] - replyDates[0]) / 3600000))
      : 0

  const signalLabel =
    signalScore === 0
      ? "Awaiting signal"
      : signalScore >= 80
        ? "High signal"
        : signalScore >= 65
          ? "Solid signal"
          : "Mixed signal"
  const consistencyLabel =
    scoreStdDev === 0
      ? "No signal yet"
      : scoreStdDev <= 12
        ? "Tight consensus"
        : scoreStdDev <= 20
          ? "Moderate spread"
          : "Wide spread"
  const medianDisplay = medianScore > 0 ? Math.round(medianScore) : null
  const signalExplanation =
    signalLabel === "Mixed signal"
      ? "Scores are strong for some replies, but the overall signal rate or consistency is uneven."
      : signalLabel === "Solid signal"
        ? "Scores and signal rate are consistently strong across qualified replies."
        : signalLabel === "High signal"
          ? "High scores and high signal rate point to clear consensus."
          : "Waiting on enough qualified replies to score signal strength."

  return {
    isComplete,
    totalReplies,
    qualifiedReplies,
    usefulReplies,
    signalRate,
    usefulRate,
    avgScore,
    medianScore,
    scoreStdDev,
    scoreSpread,
    signalScore,
    scoreAverages,
    topTags,
    topContributors,
    hiddenGems,
    activeWindow,
    repliesPerHour,
    signalLabel,
    consistencyLabel,
    medianDisplay,
    signalExplanation,
  }
}
