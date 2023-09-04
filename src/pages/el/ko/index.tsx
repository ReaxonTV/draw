import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  random,
  shuffle,
} from 'lodash'

import type Team from 'model/team/KnockoutTeam'
import {
  type KoWorkerData,
  type KoWorkerResponseData,
} from 'model/WorkerData'

import usePopup from 'store/usePopup'
import useDrawId from 'store/useDrawId'
import useFastDraw from 'store/useFastDraw'
import useXRay from 'store/useXRay'

import useMedia from 'utils/hooks/useMedia'
import useWorkerSendAndReceive from 'utils/hooks/useWorkerSendAndReceive'

import PageRoot from 'ui/PageRoot'
import PotsContainer from 'ui/PotsContainer'
import MatchupsContainer from 'ui/MatchupsContainer'
import TablesContainer from 'ui/TablesContainer'
import BowlsContainer from 'ui/BowlsContainer'
import TeamBowl from 'ui/bowls/TeamBowl'
import Separator from 'ui/Separator'
import Announcement from 'ui/Announcement'

const getEsWorker = () =>
  new Worker(new URL('./worker', import.meta.url))

interface Props {
  season: number,
  pots: readonly (readonly Team[])[],
}

interface State {
  currentMatchupNum: number,
  currentPotNum: number,
  possiblePairings: readonly number[] | null,
  pots: readonly Team[][],
  matchups: readonly [Team, Team][],
}

function getState(initialPots: readonly (readonly Team[])[], season: number): State {
  const currentPotNum = 1
  const currentMatchupNum = 0
  const numMatchups = season < 2021 ? 16 : 8
  return {
    currentMatchupNum,
    currentPotNum,
    possiblePairings: null,
    pots: initialPots.map(pot => shuffle(pot)),
    matchups: Array.from({ length: numMatchups }, () => [] as any),
  }
}

function ELKO({
  season,
  pots: initialPots,
}: Props) {
  const [drawId, setNewDrawId] = useDrawId()
  const [isFastDraw] = useFastDraw()

  const [{
    currentMatchupNum,
    currentPotNum,
    possiblePairings,
    pots,
    matchups,
  }, setState] = useState(() => getState(initialPots, season))

  useEffect(() => {
    setState(getState(initialPots, season))
  }, [initialPots, season, drawId])

  const isTallScreen = useMedia('(min-height: 750px)')
  const [, setPopup] = usePopup()
  const [isXRay] = useXRay()

  // eslint-disable-next-line max-len
  const getPossiblePairingsResponse = useWorkerSendAndReceive<KoWorkerData<Team>, KoWorkerResponseData>(getEsWorker)

  const groupsContanerRef = useRef<HTMLElement>(null)

  const getPossiblePairings = useCallback(
    async (
      newPots: readonly (readonly Team[])[],
      newMatchups: readonly [Team, Team][],
    ) => {
      try {
        const response = await getPossiblePairingsResponse({
          season,
          pots: newPots,
          matchups: newMatchups,
        })
        return response.possiblePairings
      } catch (err) {
        setPopup({
          error: 'Could not determine possible pairings',
        })
        throw err
      }
    },
    [season, getPossiblePairingsResponse],
  )

  const handleBallPick = useCallback(async (i: number) => {
    const currentPot = pots[currentPotNum]
    const index = possiblePairings ? possiblePairings[i] : i
    const selectedTeam = currentPot[index]

    const newPots = pots.slice()
    newPots[currentPotNum] = newPots[currentPotNum].filter((_, idx) => idx !== index)

    const newMatchups = matchups.slice()
    // @ts-expect-error
    newMatchups[currentMatchupNum] = [
      ...newMatchups[currentMatchupNum],
      selectedTeam,
    ]

    const newPossiblePairings = currentPotNum === 1
      ? await getPossiblePairings(newPots, newMatchups)
      : null

    const newCurrentMatchNum = currentMatchupNum - currentPotNum + 1

    setState(state => ({
      ...state,
      currentPotNum: 1 - currentPotNum,
      currentMatchupNum: newCurrentMatchNum,
      possiblePairings: newPossiblePairings,
      pots: newPots,
      matchups: newMatchups,
    }))
  }, [pots, matchups, currentPotNum, currentMatchupNum, possiblePairings])

  const autoPickIfOneBall = () => {
    if (isFastDraw) {
      return
    }
    const isOnlyChoice = possiblePairings?.length === 1
      || currentPotNum === 1 && pots[1].length === 1
    if (isOnlyChoice) {
      handleBallPick(0)
    }
  }

  useEffect(() => {
    setTimeout(autoPickIfOneBall, 250)
  }, [currentPotNum])

  const teamBowlPot = useMemo(
    () => possiblePairings && pots[0].filter((team, i) => possiblePairings.includes(i)),
    [possiblePairings],
  )

  const completed = currentMatchupNum >= initialPots[0].length

  useEffect(() => {
    if (isFastDraw) {
      const teams = teamBowlPot ?? pots[1]
      const numTeams = teams.length
      if (numTeams > 0) {
        const index = random(numTeams - 1)
        handleBallPick(index)
      }
    }
  }, [isFastDraw, currentPotNum])

  const selectedTeams = possiblePairings ? possiblePairings.map(i => pots[0][i]) : []

  return (
    <PageRoot>
      <TablesContainer>
        <PotsContainer
          selectedTeams={selectedTeams}
          initialPots={initialPots}
          pots={pots}
          currentPotNum={currentPotNum}
          split={!isTallScreen && season < 2021}
        />
        <MatchupsContainer
          ref={groupsContanerRef}
          matchups={matchups}
        />
      </TablesContainer>
      <BowlsContainer>
        {!isFastDraw && (
          <>
            {!completed && (
              <Separator>Runners-up</Separator>
            )}
            <TeamBowl
              forceNoSelect={currentPotNum === 0}
              display={!completed}
              displayTeams={isXRay}
              selectedTeam={null}
              pot={pots[1]}
              onPick={handleBallPick}
            />
            {!completed && (
              <Separator>Group Winners</Separator>
            )}
            {teamBowlPot && (
              <TeamBowl
                forceNoSelect={currentPotNum === 1}
                display={!completed}
                displayTeams={isXRay}
                selectedTeam={null}
                pot={teamBowlPot}
                onPick={handleBallPick}
              />
            )}
          </>
        )}
        {completed && (
          <Announcement
            long={false}
            completed={completed}
            selectedTeam={null}
            pickedGroup={null}
            possibleGroups={null}
            numGroups={0}
            groupsElement={groupsContanerRef}
            reset={setNewDrawId}
          />
        )}
      </BowlsContainer>
    </PageRoot>
  )
}

export default memo(ELKO)
