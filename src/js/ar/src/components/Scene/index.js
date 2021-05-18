import React, {useContext} from 'react'
import {connect} from "react-redux"

import {getSceneObjects, getWorld} from "../../../../shared/reducers/shot-generator"
import {SceneState} from "../../helpers/sceneState"


import Environment from "../Three/Environment"
import Model from "../Three/Model"
import Image from "../Three/Image"
import Light from "../Three/Light"
import VirtualCamera from "../Three/VirtualCamera"
import Character from "../Three/Character"
import Background from "../Three/Background"
import Ground from "../Three/Ground"
import Teleport from '../Three/Teleport'


import WorldCamera from '../Three/WorldCamera'
import CameraCreator from '../Three/CameraCreator'

const componentMap = {
  object: Model,
  image: Image,
  light: Light,
  camera: VirtualCamera,
  character: Character
}

const renderObject = (sceneObject, getAsset) => {
  const Component = componentMap[sceneObject.type]
  if (Component) {
     return <Component id={sceneObject.id} key={sceneObject.id} getAsset={getAsset}/>
  }
  
  return null
}

const Scene = ({sceneObjects, world, getAsset}) => {
  const [currentSceneState] = useContext(SceneState)
  
  return (
    <group>
      <WorldCamera/>
      <group
        scale={[currentSceneState.scale, currentSceneState.scale, currentSceneState.scale]}
      >
        <Teleport/>
        <CameraCreator/>
        <Background/>
        <Ground getAsset={getAsset}/>
        <ambientLight
          color={ 0xffffff }
          intensity={ world.ambient.intensity }
        />
        <directionalLight
          color={ 0xffffff }
          intensity={ world.directional.intensity }
          position={ [0, 1.5, 0] }
          target-position={ [0, 0, 0.4] }
        />
        <Environment getAsset={getAsset}/>
        {Object.values(sceneObjects).map(target => renderObject(target, getAsset))}
      </group>
    </group>
  )
}

const mapStateToProps = (state) => ({
  sceneObjects: getSceneObjects(state),
  world: getWorld(state)
})

export default connect(mapStateToProps)(Scene)
