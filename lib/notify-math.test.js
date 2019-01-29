import test from 'ava'

import {
  isRising,
  isFalling,
  equalityChanged
} from './notify-math'

test('isRising off compare value', t => {
  t.false(isRising(1, 1, 10))
  t.false(isRising(1, 2, 10))
  t.false(isRising(2, 1, 10))
})

test('isFalling off compare value', t => {
  t.false(isFalling(1, 1, 10))
  t.false(isFalling(1, 2, 10))
  t.false(isFalling(2, 1, 10))
})

test('isRising clear', t => {
  t.true(isRising(1, 3, 2))
})

test('isFalling clear', t => {
  t.true(isFalling(3, 1, 2))
})

test('isRising on compare value', t => {
  t.false(isRising(2, 2, 2))
  t.false(isRising(1, 2, 2))
  t.true(isRising(2, 3, 2))
})

test('isFalling on compare value', t => {
  t.false(isFalling(2, 2, 2))
  t.false(isFalling(3, 2, 2))
  t.true(isFalling(2, 1, 2))
})

test('equalityChanged', t => {
  t.false(equalityChanged(1, 1, 1))
  t.false(equalityChanged(1, 1, 2))

  t.true(equalityChanged(1, 2, 2))
  t.true(equalityChanged(2, 1, 2))
})
