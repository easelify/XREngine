import { Downgraded } from '@speigg/hookstate'
import classNames from 'classnames'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MediaStreamService, useMediaStreamState } from '@xrengine/client-core/src/media/services/MediaStreamService'
import { useLocationState } from '@xrengine/client-core/src/social/services/LocationService'
import { MediaStreams } from '@xrengine/client-core/src/transports/MediaStreams'
import {
  applyScreenshareToTexture,
  globalMuteProducer,
  globalUnmuteProducer,
  pauseConsumer,
  pauseProducer,
  resumeConsumer,
  resumeProducer
} from '@xrengine/client-core/src/transports/SocketWebRTCClientFunctions'
import { getAvatarURLForUser } from '@xrengine/client-core/src/user/components/UserMenu/util'
import { useAuthState } from '@xrengine/client-core/src/user/services/AuthService'
import { useUserState } from '@xrengine/client-core/src/user/services/UserService'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { useEngineState } from '@xrengine/engine/src/ecs/classes/EngineState'
import { MessageTypes } from '@xrengine/engine/src/networking/enums/MessageTypes'
import { SCENE_COMPONENT_AUDIO_SETTINGS_DEFAULT_VALUES } from '@xrengine/engine/src/scene/functions/loaders/AudioSettingFunctions'

import {
  Launch,
  Mic,
  MicOff,
  RecordVoiceOver,
  Videocam,
  VideocamOff,
  VoiceOverOff,
  VolumeDown,
  VolumeMute,
  VolumeOff,
  VolumeUp
} from '@mui/icons-material'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Tooltip from '@mui/material/Tooltip'

import { useMediaInstanceConnectionState } from '../../common/services/MediaInstanceConnectionService'
import { SocketWebRTCClientNetwork } from '../../transports/SocketWebRTCClientNetwork'
import Draggable from './Draggable'
import styles from './index.module.scss'

interface ContainerProportions {
  width: number | string
  height: number | string
}

interface Props {
  peerId?: string | 'cam_me' | 'screen_me'
}

const PartyParticipantWindow = ({ peerId }: Props): JSX.Element => {
  const [isPiP, setPiP] = useState(false)
  const [videoStream, _setVideoStream] = useState<any>(null)
  const [audioStream, _setAudioStream] = useState<any>(null)
  const [videoStreamPaused, setVideoStreamPaused] = useState(false)
  const [audioStreamPaused, setAudioStreamPaused] = useState(false)
  const [videoProducerPaused, setVideoProducerPaused] = useState(false)
  const [audioProducerPaused, setAudioProducerPaused] = useState(false)
  const [videoProducerGlobalMute, setVideoProducerGlobalMute] = useState(false)
  const [audioProducerGlobalMute, setAudioProducerGlobalMute] = useState(false)
  const [audioTrackClones, setAudioTrackClones] = useState<any[]>([])
  const [videoTrackClones, setVideoTrackClones] = useState<any[]>([])
  const [volume, setVolume] = useState(100)
  const userState = useUserState()
  const videoRef = React.useRef<any>()
  const audioRef = React.useRef<any>()
  const videoStreamRef = useRef(videoStream)
  const audioStreamRef = useRef(audioStream)
  const mediastream = useMediaStreamState()
  const { t } = useTranslation()

  const userHasInteracted = useEngineState().userHasInteracted
  const selfUser = useAuthState().user.value
  const currentLocation = useLocationState().currentLocation.location
  const enableGlobalMute =
    currentLocation?.locationSetting?.locationType?.value === 'showroom' &&
    selfUser?.locationAdmins?.find((locationAdmin) => currentLocation?.id?.value === locationAdmin.locationId) != null
  const isScreen = peerId && peerId.startsWith('screen_')
  const userId = isScreen ? peerId!.replace('screen_', '') : peerId
  const user = userState.layerUsers.find((user) => user.id.value === userId)?.attach(Downgraded).value

  const isCamVideoEnabled = isScreen ? mediastream.isScreenVideoEnabled : mediastream.isCamVideoEnabled
  const isCamAudioEnabled = isScreen ? mediastream.isScreenAudioEnabled : mediastream.isCamAudioEnabled
  const consumers = mediastream.consumers

  const channelConnectionState = useMediaInstanceConnectionState()
  const currentChannelInstanceConnection =
    channelConnectionState.instances[Engine.instance.currentWorld.mediaNetwork?.hostId].ornull

  const setVideoStream = (value) => {
    videoStreamRef.current = value
    _setVideoStream(value)
  }

  const setAudioStream = (value) => {
    audioStreamRef.current = value
    _setAudioStream(value)
  }

  const pauseConsumerListener = (consumerId: string) => {
    if (consumerId === videoStreamRef?.current?.id) {
      setVideoProducerPaused(true)
    } else if (consumerId === audioStreamRef?.current?.id) {
      setAudioProducerPaused(true)
    }
  }

  const resumeConsumerListener = (consumerId: string) => {
    if (consumerId === videoStreamRef?.current?.id) {
      setVideoProducerPaused(false)
    } else if (consumerId === audioStreamRef?.current?.id) {
      setAudioProducerPaused(false)
    }
  }

  const pauseProducerListener = (producerId: string, globalMute: boolean) => {
    if (producerId === videoStreamRef?.current?.id && globalMute) {
      setVideoProducerPaused(true)
      setVideoProducerGlobalMute(true)
    } else if (producerId === audioStreamRef?.current?.id && globalMute) {
      setAudioProducerPaused(true)
      setAudioProducerGlobalMute(true)
    }
  }

  const resumeProducerListener = (producerId: string) => {
    if (producerId === videoStreamRef?.current?.id) {
      setVideoProducerPaused(false)
      setVideoProducerGlobalMute(false)
    } else if (producerId === audioStreamRef?.current?.id) {
      setAudioProducerPaused(false)
      setAudioProducerGlobalMute(false)
    }
  }

  useEffect(() => {
    if (peerId === 'cam_me') {
      setVideoStream(MediaStreams.instance.camVideoProducer)
      setVideoStreamPaused(MediaStreams.instance.videoPaused)
    } else if (peerId === 'screen_me') setVideoStream(MediaStreams.instance.screenVideoProducer)
  }, [isCamVideoEnabled.value])

  useEffect(() => {
    if (peerId === 'cam_me') {
      setAudioStream(MediaStreams.instance.camAudioProducer)
      setAudioStreamPaused(MediaStreams.instance.audioPaused)
    } else if (peerId === 'screen_me') setAudioStream(MediaStreams.instance.screenAudioProducer)
  }, [isCamAudioEnabled.value])

  useEffect(() => {
    if (peerId !== 'cam_me' && peerId !== 'screen_me') {
      const network = Engine.instance.currentWorld.mediaNetwork as SocketWebRTCClientNetwork
      setVideoStream(
        network.consumers?.find(
          (c) => c.appData.peerId === userId && c.appData.mediaTag === (isScreen ? 'screen-video' : 'cam-video')
        )
      )
      setAudioStream(
        network.consumers?.find(
          (c) => c.appData.peerId === userId && c.appData.mediaTag === (isScreen ? 'screen-audio' : 'cam-audio')
        )
      )
    }
  }, [consumers.value])

  useEffect(() => {
    if (userHasInteracted.value && peerId !== 'cam_me' && peerId !== 'screen_me') {
      videoRef.current?.play()
      audioRef.current?.play()
    }
  }, [userHasInteracted.value])

  useEffect(() => {
    // TODO: uncomment these two lines to silence main audio in favor of spatial audio
    // if (SCENE_COMPONENT_AUDIO_SETTINGS_DEFAULT_VALUES.usePositionalAudio && audioRef.current != null)
    //   audioRef.current.volume = 0
    // else audioRef.current!.volume = volume / 100
    // (selfUser?.user_setting?.spatialAudioEnabled === false || selfUser?.user_setting?.spatialAudioEnabled === 0) &&
    // Engine.instance.spatialAudio
  }, [selfUser])

  useEffect(() => {
    if (!currentChannelInstanceConnection) return
    const mediaNetwork = Engine.instance.currentWorld.mediaNetwork as SocketWebRTCClientNetwork
    const socket = mediaNetwork.socket
    if (typeof socket?.on === 'function') socket?.on(MessageTypes.WebRTCPauseConsumer.toString(), pauseConsumerListener)
    if (typeof socket?.on === 'function')
      socket?.on(MessageTypes.WebRTCResumeConsumer.toString(), resumeConsumerListener)
    if (typeof socket?.on === 'function') socket?.on(MessageTypes.WebRTCPauseProducer.toString(), pauseProducerListener)
    if (typeof socket?.on === 'function')
      socket?.on(MessageTypes.WebRTCResumeProducer.toString(), resumeProducerListener)

    return () => {
      if (typeof socket?.on === 'function')
        socket?.off(MessageTypes.WebRTCPauseConsumer.toString(), pauseConsumerListener)
      if (typeof socket?.on === 'function')
        socket?.off(MessageTypes.WebRTCResumeConsumer.toString(), resumeConsumerListener)
      if (typeof socket?.on === 'function')
        socket?.off(MessageTypes.WebRTCPauseProducer.toString(), pauseProducerListener)
      if (typeof socket?.on === 'function')
        socket?.off(MessageTypes.WebRTCResumeProducer.toString(), resumeProducerListener)
    }
  }, [currentChannelInstanceConnection])

  useEffect(() => {
    if (audioRef.current != null) {
      audioRef.current.id = `${peerId}_audio`
      audioRef.current.autoplay = true
      audioRef.current.setAttribute('playsinline', 'true')
      if (peerId === 'cam_me' || peerId === 'screen_me') {
        audioRef.current.muted = true
      }
      if (audioStream != null) {
        const newAudioTrack = audioStream.track.clone()
        const updateAudioTrackClones = audioTrackClones.concat(newAudioTrack)
        setAudioTrackClones(updateAudioTrackClones)
        audioRef.current.srcObject = new MediaStream([newAudioTrack])
        setAudioProducerPaused(audioStream.paused)
      }
      // TODO: handle 3d spatial audio switch on/off
      // if (selfUser?.user_setting?.spatialAudioEnabled === true) audioRef.current.volume = 0
      // {
      audioRef.current.volume = volume / 100
      // PositionalAudioSystem.instance?.suspend()
      // }
      // selfUser?.user_setting?.spatialAudioEnabled === false ||
      // (selfUser?.user_setting?.spatialAudioEnabled === 0 && Engine.instance.spatialAudio)
      setVolume(volume)
    }

    return () => {
      audioTrackClones.forEach((track) => track.stop())
    }
  }, [audioStream])

  useEffect(() => {
    if (videoRef.current != null) {
      videoRef.current.id = `${peerId}_video`
      videoRef.current.autoplay = true
      videoRef.current.muted = true
      videoRef.current.setAttribute('playsinline', 'true')
      if (videoStream != null) {
        setVideoProducerPaused(videoStream.paused)
        const originalTrackEnabledInterval = setInterval(() => {
          if (videoStream.track.enabled) {
            clearInterval(originalTrackEnabledInterval)

            if (!videoRef.current?.srcObject?.active || !videoRef.current?.srcObject?.getVideoTracks()[0].enabled) {
              const newVideoTrack = videoStream.track.clone()
              videoTrackClones.forEach((track) => track.stop())
              setVideoTrackClones([newVideoTrack])
              videoRef.current.srcObject = new MediaStream([newVideoTrack])
              if (isScreen) {
                applyScreenshareToTexture(videoRef.current)
              }
            }
          }
        }, 100)
      }
    }

    return () => {
      videoTrackClones.forEach((track) => track.stop())
    }
  }, [videoStream])

  useEffect(() => {
    if (peerId === 'cam_me' || peerId === 'screen_me') {
      setAudioStreamPaused(MediaStreams.instance.audioPaused)
      if (!MediaStreams.instance.audioPaused && audioStream != null && audioRef.current != null) {
        const originalTrackEnabledInterval = setInterval(() => {
          if (audioStream.track.enabled) {
            clearInterval(originalTrackEnabledInterval)

            if (!audioRef.current?.srcObject?.getAudioTracks()[0].enabled) {
              const newAudioTrack = audioStream.track.clone()
              const updateAudioTrackClones = audioTrackClones.concat(newAudioTrack)
              setAudioTrackClones(updateAudioTrackClones)
              audioRef.current.srcObject = new MediaStream([newAudioTrack])
            }
          }
        })
      }
    }
  }, [MediaStreams.instance.audioPaused])

  useEffect(() => {
    if (peerId === 'cam_me' || peerId === 'screen_me') {
      setVideoStreamPaused(MediaStreams.instance.videoPaused)
      if (!MediaStreams.instance.videoPaused && videoStream != null && videoRef.current != null) {
        const originalTrackEnabledInterval = setInterval(() => {
          if (videoStream.track.enabled) {
            clearInterval(originalTrackEnabledInterval)

            if (!videoRef.current?.srcObject?.getVideoTracks()[0].enabled) {
              const newVideoTrack = videoStream.track.clone()
              videoTrackClones.forEach((track) => track.stop())
              setVideoTrackClones([newVideoTrack])
              videoRef.current.srcObject = new MediaStream([newVideoTrack])
            }
          }
        }, 100)
      }
    }
  }, [MediaStreams.instance.videoPaused])

  useEffect(() => {
    if (
      !(peerId === 'cam_me' || peerId === 'screen_me') &&
      !videoProducerPaused &&
      videoStream != null &&
      videoRef.current != null
    ) {
      const originalTrackEnabledInterval = setInterval(() => {
        if (videoStream.track.enabled) {
          clearInterval(originalTrackEnabledInterval)

          if (!videoRef.current?.srcObject?.getVideoTracks()[0].enabled) {
            const newVideoTrack = videoStream.track.clone()
            videoTrackClones.forEach((track) => track.stop())
            setVideoTrackClones([newVideoTrack])
            videoRef.current.srcObject = new MediaStream([newVideoTrack])
          }
        }
      }, 100)
    }
  }, [videoProducerPaused])

  useEffect(() => {
    if (
      !(peerId === 'cam_me' || peerId === 'screen_me') &&
      !audioProducerPaused &&
      audioStream != null &&
      audioRef.current != null
    ) {
      const originalTrackEnabledInterval = setInterval(() => {
        if (audioStream.track.enabled) {
          clearInterval(originalTrackEnabledInterval)

          if (!audioRef.current?.srcObject?.getAudioTracks()[0].enabled) {
            const newAudioTrack = audioStream.track.clone()
            const updateAudioTrackClones = audioTrackClones.concat(newAudioTrack)
            setAudioTrackClones(updateAudioTrackClones)
            audioRef.current.srcObject = new MediaStream([newAudioTrack])
          }
        }
      })
    }
  }, [audioProducerPaused])

  const toggleVideo = async (e) => {
    e.stopPropagation()
    const mediaNetwork = Engine.instance.currentWorld.mediaNetwork as SocketWebRTCClientNetwork
    if (peerId === 'cam_me') {
      const videoPaused = MediaStreams.instance.toggleVideoPaused()
      if (videoPaused) await pauseProducer(mediaNetwork, MediaStreams.instance.camVideoProducer)
      else await resumeProducer(mediaNetwork, MediaStreams.instance.camVideoProducer)
      MediaStreamService.updateCamVideoState()
    } else if (peerId === 'screen_me') {
      const videoPaused = MediaStreams.instance.toggleScreenShareVideoPaused()
      if (videoPaused) await pauseProducer(mediaNetwork, MediaStreams.instance.screenVideoProducer)
      else await resumeProducer(mediaNetwork, MediaStreams.instance.screenVideoProducer)
      setVideoStreamPaused(videoPaused)
      MediaStreamService.updateScreenAudioState()
      MediaStreamService.updateScreenVideoState()
    } else {
      if (videoStream.paused === false) {
        await pauseConsumer(mediaNetwork, videoStream)
        setVideoStreamPaused(true)
      } else {
        await resumeConsumer(mediaNetwork, videoStream)
        setVideoStreamPaused(false)
      }
    }
  }

  const toggleAudio = async (e) => {
    e.stopPropagation()
    const mediaNetwork = Engine.instance.currentWorld.mediaNetwork as SocketWebRTCClientNetwork
    if (peerId === 'cam_me') {
      const audioPaused = MediaStreams.instance.toggleAudioPaused()
      if (audioPaused) await pauseProducer(mediaNetwork, MediaStreams.instance.camAudioProducer)
      else await resumeProducer(mediaNetwork, MediaStreams.instance.camAudioProducer)
      MediaStreamService.updateCamAudioState()
    } else if (peerId === 'screen_me') {
      const audioPaused = MediaStreams.instance.toggleScreenShareAudioPaused()
      if (audioPaused) await pauseProducer(mediaNetwork, MediaStreams.instance.screenAudioProducer)
      else await resumeProducer(mediaNetwork, MediaStreams.instance.screenAudioProducer)
      setAudioStreamPaused(audioPaused)
    } else {
      if (audioStream.paused === false) {
        await pauseConsumer(mediaNetwork, audioStream)
        setAudioStreamPaused(true)
      } else {
        await resumeConsumer(mediaNetwork, audioStream)
        setAudioStreamPaused(false)
      }
    }
  }

  const toggleGlobalMute = async (e) => {
    e.stopPropagation()
    const mediaNetwork = Engine.instance.currentWorld.mediaNetwork as SocketWebRTCClientNetwork
    if (!audioProducerGlobalMute) {
      await globalMuteProducer(mediaNetwork, { id: audioStream.producerId })
      setAudioProducerGlobalMute(true)
    } else if (audioProducerGlobalMute) {
      await globalUnmuteProducer(mediaNetwork, { id: audioStream.producerId })
      setAudioProducerGlobalMute(false)
    }
  }

  const adjustVolume = (e, newValue) => {
    if (peerId === 'cam_me' || peerId === 'screen_me') {
      MediaStreams.instance.audioGainNode.gain.setValueAtTime(
        newValue / 100,
        MediaStreams.instance.audioGainNode.context.currentTime + 1
      )
    } else {
      audioRef.current.volume = newValue / 100
    }
    setVolume(newValue)
  }

  const getUsername = () => {
    if (peerId === 'cam_me') return t('user:person.you')
    if (peerId === 'screen_me') return t('user:person.yourScreen')
    if (peerId?.startsWith('screen_')) return user?.name + "'s Screen"
    return user?.name
  }

  const togglePiP = () => setPiP(!isPiP)

  const isSelfUser = peerId === 'cam_me' || peerId === 'screen_me'
  const username = getUsername()

  return (
    <Draggable isPiP={isPiP}>
      <div
        tabIndex={0}
        id={peerId + '_container'}
        className={classNames({
          [styles['party-chat-user']]: true,
          [styles['self-user']]: peerId === 'cam_me',
          [styles['no-video']]: videoStream == null,
          [styles['video-paused']]: videoStream && (videoProducerPaused || videoStreamPaused),
          [styles.pip]: isPiP
        })}
      >
        <div className={styles['video-wrapper']}>
          {(videoStream == null || videoStreamPaused || videoProducerPaused || videoProducerGlobalMute) && (
            <img src={getAvatarURLForUser(isSelfUser ? selfUser?.id : user?.id)} draggable={false} />
          )}
          <video key={peerId + '_cam'} ref={videoRef} draggable={false} />
        </div>
        <audio key={peerId + '_audio'} ref={audioRef} />
        <div className={styles['user-controls']}>
          <div className={styles['username']}>{username}</div>
          <div className={styles['controls']}>
            <div className={styles['mute-controls']}>
              {videoStream && !videoProducerPaused ? (
                <Tooltip title={!videoProducerPaused && !videoStreamPaused ? 'Pause Video' : 'Resume Video'}>
                  <IconButton color="secondary" size="small" className={styles['video-control']} onClick={toggleVideo}>
                    {videoStreamPaused ? <VideocamOff /> : <Videocam />}
                  </IconButton>
                </Tooltip>
              ) : null}
              {enableGlobalMute && peerId !== 'cam_me' && peerId !== 'screen_me' && audioStream && (
                <Tooltip
                  title={
                    !audioProducerGlobalMute
                      ? (t('user:person.muteForEveryone') as string)
                      : (t('user:person.unmuteForEveryone') as string)
                  }
                >
                  <IconButton
                    color="secondary"
                    size="small"
                    className={styles['audio-control']}
                    onClick={toggleGlobalMute}
                  >
                    {audioProducerGlobalMute ? <VoiceOverOff /> : <RecordVoiceOver />}
                  </IconButton>
                </Tooltip>
              )}
              {audioStream && !audioProducerPaused ? (
                <Tooltip
                  title={
                    (isSelfUser && audioStream?.paused === false
                      ? t('user:person.muteMe')
                      : isSelfUser && audioStream?.paused === true
                      ? t('user:person.unmuteMe')
                      : peerId !== 'cam_me' && peerId !== 'screen_me' && audioStream?.paused === false
                      ? t('user:person.muteThisPerson')
                      : t('user:person.unmuteThisPerson')) as string
                  }
                >
                  <IconButton color="secondary" size="small" className={styles['audio-control']} onClick={toggleAudio}>
                    {isSelfUser ? (
                      audioStreamPaused ? (
                        <MicOff />
                      ) : (
                        <Mic />
                      )
                    ) : audioStreamPaused ? (
                      <VolumeOff />
                    ) : (
                      <VolumeUp />
                    )}
                  </IconButton>
                </Tooltip>
              ) : null}
              <Tooltip title={t('user:person.openPictureInPicture') as string}>
                <IconButton
                  color="secondary"
                  size="small"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    togglePiP()
                  }}
                >
                  <Launch className={styles.pipBtn} />
                </IconButton>
              </Tooltip>
            </div>
            {audioProducerGlobalMute && <div className={styles['global-mute']}>Muted by Admin</div>}
            {audioStream &&
              !audioProducerPaused &&
              !audioProducerGlobalMute &&
              selfUser?.user_setting?.spatialAudioEnabled === false && (
                <div className={styles['audio-slider']}>
                  {volume > 0 && <VolumeDown />}
                  {volume === 0 && <VolumeMute />}
                  <Slider value={volume} onChange={adjustVolume} aria-labelledby="continuous-slider" />
                  <VolumeUp />
                </div>
              )}
          </div>
        </div>
      </div>
    </Draggable>
  )
}

export default PartyParticipantWindow
