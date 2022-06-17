import {
  ActiveCollisionTypes,
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  RigidBodyType
} from '@dimforge/rapier3d-compat'
import assert from 'assert'
import { Vector3 } from 'three'

import ActionFunctions from '@xrengine/hyperflux/functions/ActionFunctions'

import { Direction } from '../../common/constants/Axis3D'
import { Engine } from '../../ecs/classes/Engine'
import { getComponent, hasComponent } from '../../ecs/functions/ComponentFunctions'
import { createEntity } from '../../ecs/functions/EntityFunctions'
import { createEngine } from '../../initializeEngine'
import { RapierCollisionComponent } from '../components/RapierCollisionComponent'
import { RigidBodyComponent } from '../components/RigidBodyComponent'
import { RigidBodyDynamicTagComponent } from '../components/RigidBodyDynamicTagComponent'
import { RigidBodyFixedTagComponent } from '../components/RigidBodyFixedTagComponent'
import { CollisionGroups, DefaultCollisionMask } from '../enums/CollisionGroups'
import { getInteractionGroups } from '../functions/getInteractionGroups'
import { getTagComponentForRigidBody } from '../functions/getTagComponentForRigidBody'
import { PhysicsAction } from '../functions/PhysicsActions'
import { CollisionEvents, RaycastHit, SceneQueryType } from '../types/PhysicsTypes'
import { Physics } from './PhysicsRapier'

describe('Physics', () => {
  before(async () => {
    createEngine()
    await Physics.load()
  })

  it('should create rapier world & event queue', async () => {
    const world = Physics.createWorld()
    const eventQueue = Physics.createCollisionEventQueue()
    assert(world)
    assert(eventQueue)
  })

  it('should create & remove rigidBody', async () => {
    const world = Engine.instance.currentWorld
    const entity = createEntity(world)

    const physicsWorld = Physics.createWorld()

    const rigidBodyDesc = RigidBodyDesc.dynamic()
    const colliderDesc = ColliderDesc.ball(1)

    const rigidBody = Physics.createRigidBody(entity, physicsWorld, rigidBodyDesc, [colliderDesc])

    assert.deepEqual(physicsWorld.bodies.len(), 1)
    assert.deepEqual(physicsWorld.colliders.len(), 1)
    assert.deepEqual(hasComponent(entity, RigidBodyComponent), true)
    assert.deepEqual(getComponent(entity, RigidBodyComponent), rigidBody)
    assert.deepEqual(hasComponent(entity, RigidBodyDynamicTagComponent), true)
    assert.deepEqual((rigidBody.userData as any)['entity'], entity)

    Physics.removeRigidBody(entity, physicsWorld)
    assert.deepEqual(physicsWorld.bodies.len(), 0)
    assert.deepEqual(hasComponent(entity, RigidBodyComponent), false)
    assert.deepEqual(hasComponent(entity, RigidBodyDynamicTagComponent), false)
  })

  it('component type should match rigid body type', async () => {
    const world = Engine.instance.currentWorld
    const entity = createEntity(world)

    const physicsWorld = Physics.createWorld()

    const rigidBodyDesc = RigidBodyDesc.fixed()
    const colliderDesc = ColliderDesc.ball(1)

    const rigidBody = Physics.createRigidBody(entity, physicsWorld, rigidBodyDesc, [colliderDesc])
    const rigidBodyComponent = getTagComponentForRigidBody(rigidBody)

    assert.deepEqual(rigidBodyComponent, RigidBodyFixedTagComponent)
  })

  it('should change rigidBody type', async () => {
    const world = Engine.instance.currentWorld
    const entity = createEntity(world)

    const physicsWorld = Physics.createWorld()

    const rigidBodyDesc = RigidBodyDesc.dynamic()
    const colliderDesc = ColliderDesc.ball(1)

    const rigidBody = Physics.createRigidBody(entity, physicsWorld, rigidBodyDesc, [colliderDesc])

    assert.deepEqual(physicsWorld.bodies.len(), 1)
    assert.deepEqual(rigidBody.bodyType(), RigidBodyType.Dynamic)
    assert.deepEqual(hasComponent(entity, RigidBodyDynamicTagComponent), true)

    Physics.changeRigidbodyType(entity, RigidBodyType.Fixed)
    assert.deepEqual(rigidBody.bodyType(), RigidBodyType.Fixed)
    assert.deepEqual(hasComponent(entity, RigidBodyDynamicTagComponent), false)
    assert.deepEqual(hasComponent(entity, RigidBodyFixedTagComponent), true)
  })

  it('should create accurate InteractionGroups', async () => {
    const collisionGroup = 0x0001
    const collisionMask = 0x0003
    const interactionGroups = getInteractionGroups(collisionGroup, collisionMask)

    assert.deepEqual(interactionGroups, 65539)
  })

  it('should cast ray and hit rigidbody', async () => {
    const world = Engine.instance.currentWorld
    const entity = createEntity(world)

    const physicsWorld = Physics.createWorld()

    const rigidBodyDesc = RigidBodyDesc.dynamic().setTranslation(10, 0, 0)
    const colliderDesc = ColliderDesc.cylinder(5, 5).setCollisionGroups(
      getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask)
    )

    const rigidBody = Physics.createRigidBody(entity, physicsWorld, rigidBodyDesc, [colliderDesc])

    physicsWorld.step()

    const raycastComponentData = {
      filterData: null, // TODO
      type: SceneQueryType.Closest,
      hits: [] as RaycastHit[],
      origin: new Vector3().set(0, 1, 0),
      direction: Direction.Right,
      maxDistance: 20,
      flags: getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask)
    }
    Physics.castRay(physicsWorld, raycastComponentData)

    assert.deepEqual(raycastComponentData.hits.length, 1)
    assert.deepEqual(raycastComponentData.hits[0].normal.x, -1)
    assert.deepEqual(raycastComponentData.hits[0].distance, 5)
    assert.deepEqual(raycastComponentData.hits[0].body, rigidBody)
  })

  it('should generate a collision event', async () => {
    const world = Engine.instance.currentWorld
    const entity1 = createEntity(world)
    const entity2 = createEntity(world)

    const physicsWorld = Physics.createWorld()
    const collisionEventQueue = Physics.createCollisionEventQueue()

    const rigidBodyDesc = RigidBodyDesc.dynamic()
    const colliderDesc = ColliderDesc.ball(1)
      .setCollisionGroups(getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask))
      .setActiveCollisionTypes(ActiveCollisionTypes.ALL)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS)

    const rigidBody1 = Physics.createRigidBody(entity1, physicsWorld, rigidBodyDesc, [colliderDesc])
    const rigidBody2 = Physics.createRigidBody(entity2, physicsWorld, rigidBodyDesc, [colliderDesc])

    let collisionStartEventsCount = 0
    const collisionStartedEventReceptor = (action) => {
      assert(PhysicsAction.collisionStarted.matches.test(action))
      collisionStartEventsCount++
    }
    let collisionEndEventsCount = 0
    const collisionEndedEventReceptor = (action) => {
      assert(PhysicsAction.collisionEnded.matches.test(action))
      collisionEndEventsCount++
    }
    let triggerStartEventsCount = 0
    const triggerStartedEventReceptor = (action) => {
      assert(PhysicsAction.triggerStarted.matches.test(action))
      triggerStartEventsCount++
    }
    let triggerEndEventsCount = 0
    const triggerEndedEventReceptor = (action) => {
      assert(PhysicsAction.triggerEnded.matches.test(action))
      triggerEndEventsCount++
    }

    const collisionStartedActionQueue = ActionFunctions.createActionQueue(PhysicsAction.collisionStarted.matches)
    const collisionEndedActionQueue = ActionFunctions.createActionQueue(PhysicsAction.collisionEnded.matches)
    const triggerStartedActionQueue = ActionFunctions.createActionQueue(PhysicsAction.triggerStarted.matches)
    const triggerEndedActionQueue = ActionFunctions.createActionQueue(PhysicsAction.triggerEnded.matches)

    physicsWorld.step(collisionEventQueue)
    Physics.drainCollisionEventQueue(physicsWorld, collisionEventQueue)

    // Hackish fix for now to handle weird race condition where action.$time ends up greater than now & action are not procssed in the next call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    ActionFunctions.applyIncomingActions()
    for (const action of collisionStartedActionQueue()) collisionStartedEventReceptor(action)
    for (const action of collisionEndedActionQueue()) collisionEndedEventReceptor(action)
    for (const action of triggerStartedActionQueue()) triggerStartedEventReceptor(action)
    for (const action of triggerEndedActionQueue()) triggerEndedEventReceptor(action)

    assert.equal(collisionStartEventsCount, 1)
    assert.equal(collisionEndEventsCount, 0)
    assert.equal(triggerStartEventsCount, 0)
    assert.equal(triggerEndEventsCount, 0)
    assert.equal(hasComponent(entity1, RapierCollisionComponent), true)
    assert.equal(getComponent(entity1, RapierCollisionComponent).collisions.get(entity2)?.bodySelf, rigidBody1)
    assert.equal(getComponent(entity1, RapierCollisionComponent).collisions.get(entity2)?.bodyOther, rigidBody2)
    assert.equal(
      getComponent(entity1, RapierCollisionComponent).collisions.get(entity2)?.shapeSelf,
      rigidBody1.collider(0)
    )
    assert.equal(
      getComponent(entity1, RapierCollisionComponent).collisions.get(entity2)?.shapeOther,
      rigidBody2.collider(0)
    )
    assert.equal(
      getComponent(entity1, RapierCollisionComponent).collisions.get(entity2)?.type,
      CollisionEvents.COLLISION_START
    )

    rigidBody2.setTranslation({ x: 0, y: 0, z: 15 }, true)

    physicsWorld.step(collisionEventQueue)
    Physics.drainCollisionEventQueue(physicsWorld, collisionEventQueue)

    // Hackish fix for now to handle weird race condition where action.$time ends up greater than now & action are not procssed in the next call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    ActionFunctions.applyIncomingActions()
    for (const action of collisionStartedActionQueue()) collisionStartedEventReceptor(action)
    for (const action of collisionEndedActionQueue()) collisionEndedEventReceptor(action)
    for (const action of triggerStartedActionQueue()) triggerStartedEventReceptor(action)
    for (const action of triggerEndedActionQueue()) triggerEndedEventReceptor(action)

    assert.equal(collisionStartEventsCount, 1)
    assert.equal(collisionEndEventsCount, 1)
    assert.equal(triggerStartEventsCount, 0)
    assert.equal(triggerEndEventsCount, 0)
    assert.equal(hasComponent(entity1, RapierCollisionComponent), false)
  })
})
