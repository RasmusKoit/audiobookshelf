const Sequelize = require('sequelize')
const Database = require('../../Database')
const PlaybackSession = require('../../models/PlaybackSession')
const MediaProgress = require('../../models/MediaProgress')
const { elapsedPretty } = require('../index')

module.exports = {
  /**
   * 
   * @param {string} userId 
   * @param {number} year YYYY
   * @returns {Promise<PlaybackSession[]>}
   */
  async getUserListeningSessionsForYear(userId, year) {
    const sessions = await Database.playbackSessionModel.findAll({
      where: {
        userId,
        createdAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      }
    })
    return sessions
  },

  /**
   * 
   * @param {string} userId 
   * @param {number} year YYYY
   * @returns {Promise<MediaProgress[]>}
   */
  async getBookMediaProgressFinishedForYear(userId, year) {
    const progresses = await Database.mediaProgressModel.findAll({
      where: {
        userId,
        mediaItemType: 'book',
        finishedAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      },
      include: {
        model: Database.bookModel,
        required: true
      }
    })
    return progresses
  },

  /**
   * @param {string} userId
   * @param {number} year YYYY
   */
  async getStatsForYear(userId, year) {
    const listeningSessions = await this.getUserListeningSessionsForYear(userId, year)

    let totalBookListeningTime = 0
    let totalPodcastListeningTime = 0
    let totalListeningTime = 0

    let authorListeningMap = {}
    let genreListeningMap = {}
    let narratorListeningMap = {}
    let monthListeningMap = {}

    listeningSessions.forEach((ls) => {
      const listeningSessionListeningTime = ls.timeListening || 0

      const lsMonth = ls.createdAt.getMonth()
      if (!monthListeningMap[lsMonth]) monthListeningMap[lsMonth] = 0
      monthListeningMap[lsMonth] += listeningSessionListeningTime

      totalListeningTime += listeningSessionListeningTime
      if (ls.mediaItemType === 'book') {
        totalBookListeningTime += listeningSessionListeningTime

        const authors = ls.mediaMetadata.authors || []
        authors.forEach((au) => {
          if (!authorListeningMap[au.name]) authorListeningMap[au.name] = 0
          authorListeningMap[au.name] += listeningSessionListeningTime
        })

        const narrators = ls.mediaMetadata.narrators || []
        narrators.forEach((narrator) => {
          if (!narratorListeningMap[narrator]) narratorListeningMap[narrator] = 0
          narratorListeningMap[narrator] += listeningSessionListeningTime
        })

        // Filter out bad genres like "audiobook" and "audio book"
        const genres = (ls.mediaMetadata.genres || []).filter(g => !g.toLowerCase().includes('audiobook') && !g.toLowerCase().includes('audio book'))
        genres.forEach((genre) => {
          if (!genreListeningMap[genre]) genreListeningMap[genre] = 0
          genreListeningMap[genre] += listeningSessionListeningTime
        })
      } else {
        totalPodcastListeningTime += listeningSessionListeningTime
      }
    })

    totalListeningTime = Math.round(totalListeningTime)
    totalBookListeningTime = Math.round(totalBookListeningTime)
    totalPodcastListeningTime = Math.round(totalPodcastListeningTime)

    let mostListenedAuthor = null
    for (const authorName in authorListeningMap) {
      if (!mostListenedAuthor?.time || authorListeningMap[authorName] > mostListenedAuthor.time) {
        mostListenedAuthor = {
          time: Math.round(authorListeningMap[authorName]),
          pretty: elapsedPretty(Math.round(authorListeningMap[authorName])),
          name: authorName
        }
      }
    }
    let mostListenedNarrator = null
    for (const narrator in narratorListeningMap) {
      if (!mostListenedNarrator?.time || narratorListeningMap[narrator] > mostListenedNarrator.time) {
        mostListenedNarrator = {
          time: Math.round(narratorListeningMap[narrator]),
          pretty: elapsedPretty(Math.round(narratorListeningMap[narrator])),
          name: narrator
        }
      }
    }
    let mostListenedGenre = null
    for (const genre in genreListeningMap) {
      if (!mostListenedGenre?.time || genreListeningMap[genre] > mostListenedGenre.time) {
        mostListenedGenre = {
          time: Math.round(genreListeningMap[genre]),
          pretty: elapsedPretty(Math.round(genreListeningMap[genre])),
          name: genre
        }
      }
    }
    let mostListenedMonth = null
    for (const month in monthListeningMap) {
      if (!mostListenedMonth?.time || monthListeningMap[month] > mostListenedMonth.time) {
        mostListenedMonth = {
          month: Number(month),
          time: Math.round(monthListeningMap[month]),
          pretty: elapsedPretty(Math.round(monthListeningMap[month]))
        }
      }
    }

    const bookProgresses = await this.getBookMediaProgressFinishedForYear(userId, year)

    const numBooksFinished = bookProgresses.length
    let longestAudiobookFinished = null
    bookProgresses.forEach((mediaProgress) => {
      if (mediaProgress.duration && (!longestAudiobookFinished?.duration || mediaProgress.duration > longestAudiobookFinished.duration)) {
        longestAudiobookFinished = {
          id: mediaProgress.mediaItem.id,
          title: mediaProgress.mediaItem.title,
          duration: Math.round(mediaProgress.duration),
          durationPretty: elapsedPretty(Math.round(mediaProgress.duration)),
          finishedAt: mediaProgress.finishedAt
        }
      }
    })

    return {
      totalListeningSessions: listeningSessions.length,
      totalListeningTime,
      totalListeningTimePretty: elapsedPretty(totalListeningTime),
      totalBookListeningTime,
      totalBookListeningTimePretty: elapsedPretty(totalBookListeningTime),
      totalPodcastListeningTime,
      totalPodcastListeningTimePretty: elapsedPretty(totalPodcastListeningTime),
      mostListenedAuthor,
      mostListenedNarrator,
      mostListenedGenre,
      mostListenedMonth,
      numBooksFinished,
      longestAudiobookFinished
    }
  }
}
