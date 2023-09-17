import memoizeOne from 'memoize-one'

import { firstPossibleGroup } from 'engine/backtracking/gs'
import getPredicate from 'engine/predicates/uefa/gs'
import type Team from 'model/team/GsTeam'
import {
  type GsWorkerData,
  type GsWorkerFirstPossibleResponseData,
} from 'model/WorkerData'
import exposeWorker, { type ExposedFuncType } from 'utils/worker/expose'

type GetPredicateParams = Parameters<typeof getPredicate>

const serializeArgs = ([year, groupSize]: GetPredicateParams) =>
  JSON.stringify({
    year,
    groupSize,
  })

const eqFunc = (newArgs: GetPredicateParams, oldArgs: GetPredicateParams) =>
  serializeArgs(newArgs) === serializeArgs(oldArgs)

const getPredicateMemoized = memoizeOne(getPredicate, eqFunc)

const func = (data: GsWorkerData<Team>): GsWorkerFirstPossibleResponseData => {
  const {
    season,
    pots,
    groups,
    selectedTeam,
  } = data

  const predicate = getPredicateMemoized(season, pots.length)
  const pickedGroup = firstPossibleGroup(pots, groups, selectedTeam, predicate)

  return {
    pickedGroup,
  }
}

export type Func = ExposedFuncType<typeof func>

exposeWorker(func)
