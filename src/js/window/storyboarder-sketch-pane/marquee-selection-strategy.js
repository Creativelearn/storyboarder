const paper = require('paper')

class MarqueeSelectionStrategy {
  constructor (context) {
    this.context = context
    this.name = 'marqueeSelection'

    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)

    this._onWindowBlur = this._onWindowBlur.bind(this)

    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenContext = this.offscreenCanvas.getContext('2d')

    this.paperScope = paper.setup(this.offscreenCanvas)
  }

  startup () {
    this.context.store.dispatch({ type: 'TOOLBAR_MODE_STATUS_SET', payload: 'busy', meta: { scope: 'local' } })

    this.offscreenCanvas.width = this.context.sketchPane.width
    this.offscreenCanvas.height = this.context.sketchPane.height
    this.layer = this.context.sketchPane.layers.findByName('composite')

    this.state = {
      started: false,
      complete: false,
      selectionPath: new paper.Path(),
      draftPoint: null,
      straightLinePressed: false,
      isPointerDown: false,

      stateName: 'freeform' // freeform or line
    }

    document.addEventListener('pointerdown', this._onPointerDown)
    document.addEventListener('pointermove', this._onPointerMove)
    document.addEventListener('pointerup', this._onPointerUp)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onWindowBlur)

    this.context.sketchPane.cursor.setEnabled(false)
    this.context.sketchPane.app.view.style.cursor = 'crosshair'
  }

  shutdown () {
    document.removeEventListener('pointerdown', this._onPointerDown)
    document.removeEventListener('pointermove', this._onPointerMove)
    document.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onWindowBlur)

    this.layer.clear()

    this.context.sketchPane.app.view.style.cursor = 'auto'
    this.context.sketchPane.cursor.setEnabled(true)
  }

  _isLineKeyPressed () {
    return this.context.isCommandPressed('drawing:marquee:straight-line')
  }

  _onPointerDown (event) {
    if (event.target.id === 'toolbar-marquee') return

    if (event.target !== this.context.sketchPaneDOMElement) {
      this.cancel()
      return
    }

    if (
      // has already drawn a marquee
      this.state.complete &&
      // pointerdown anywhere on the canvas
      event.target === this.context.sketchPaneDOMElement)
    {
      // transition to operating on the selection
      this.context.marqueeTransitionEvent = event
      this._transitionNext()
    }

    // if this is a new path
    if (!this.state.started) {

      // reset
      this.state.selectionPath = new paper.Path()

      // if the line key is pressed
      if (this._isLineKeyPressed()) {
        this.state.stateName = 'line'
      } else {
        this.state.stateName = 'freeform'
      }
    }

    this.state = {
      ...this.state,
      started: true,
      complete: false,
      isPointerDown: true
    }

    this._addPointFromEvent(event)
    this._draw()

    if (this.state.stateName == 'line') {
      this.state.draftPoint = this.context.sketchPane.localizePoint(event)
    } else {
      this.state.draftPoint = null
    }
  }

  _onPointerMove (event) {
    if (!this.state.started) return

    if (!this._isLineKeyPressed() && this.state.isPointerDown) {
      this.state.stateName = 'freeform'
    }

    if (this.state.stateName == 'line') {
      this.state.draftPoint = this.context.sketchPane.localizePoint(event)
    } else {
      this.state.draftPoint = null
      this._addPointFromEvent(event)
    }

    this._draw()
  }

  _onPointerUp (event) {
    this.state.isPointerDown = false

    if (!this.state.started) return

    if (this._isLineKeyPressed()) {
      this.state.stateName = 'line'
    } else {
      this.state.stateName = 'freeform'
    }

    if (this.state.stateName == 'line') {
      this._addPointFromEvent(event)
      this._draw()
    } else {
      this._addPointFromEvent(event)

      this._endDrawnPath()
    }
  }

  _endDrawnPath () {
    this.state.started = false
    this.state.complete = true

    this.state.draftPoint = null

    // close the path
    this.state.selectionPath.add(this.state.selectionPath.segments[0].point.clone())
    // avoid self-intersections
    // this.state.selectionPath = this.state.selectionPath.unite(this.state.selectionPath)
    // this.state.selectionPath.closePath()

    this._draw()

    this.context.marqueePath = this.state.selectionPath.clone()
  }

  _transitionNext () {
    this.context.store.dispatch({
      type: 'TOOLBAR_MODE_STATUS_SET', payload: 'idle', meta: { scope: 'local' }
    })
    this.context.store.dispatch({
      type: 'TOOLBAR_MODE_SET', payload: 'marqueeOperation', meta: { scope: 'local' }
    })
  }

  _addPointFromEvent (event) {
    let point = this.context.sketchPane.localizePoint(event)
    this.state.selectionPath.add(new paper.Point(point.x, point.y))
  }

  _onWindowBlur () {
    // this.cancel()
  }

  _onKeyDown (event) {
    event.preventDefault()

    if (this.context.isCommandPressed('drawing:marquee:cancel')) {
      this.cancel()
    }
  }

  _onKeyUp (event) {
    event.preventDefault()

    if (!this._isLineKeyPressed()) {
      if (this.state.started && this.state.stateName == 'line' && !this.state.isPointerDown) {
        this._endDrawnPath()
      }
    }
  }

  cancel () {
    // attempt to gracefully transition back to drawing
    this.context.store.dispatch({
      type: 'TOOLBAR_MODE_STATUS_SET', payload: 'idle', meta: { scope: 'local' }
    })
    this.context.store.dispatch({ type: 'TOOLBAR_MODE_SET', payload: 'drawing', meta: { scope: 'local' } })
  }

  _draw () {
    let ctx = this.offscreenContext

    ctx.clearRect(0, 0, this.context.sketchPane.width, this.context.sketchPane.height)
    ctx.globalAlpha = 1.0

    let pointsToDraw = this.state.selectionPath.segments.map(segment => ({ x: segment.point.x, y: segment.point.y }))
    if (this.state.draftPoint != null) {
      pointsToDraw.push(this.state.draftPoint)
    }

    ctx.save()

    // white
    ctx.lineWidth = 9
    ctx.strokeStyle = '#fff'
    ctx.setLineDash([])
    ctx.moveTo(pointsToDraw[0].x, pointsToDraw[0].y)
    ctx.beginPath()
    for (let i = 1; i < pointsToDraw.length; i++) {
      let point = pointsToDraw[i]
      ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.stroke()

    // purple
    ctx.lineWidth = 3
    ctx.strokeStyle = '#6A4DE7'
    ctx.setLineDash([5, 15])
    ctx.moveTo(pointsToDraw[0].x, pointsToDraw[0].y)
    ctx.beginPath()
    for (let i = 1; i < pointsToDraw.length; i++) {
      let point = pointsToDraw[i]
      ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.stroke()

    ctx.restore()

    // diagnostic circles:
    //
    // for (let j = 0; j < pointsToDraw.length; j++) {
    //   let point = pointsToDraw[j]
    //   ctx.beginPath()
    //   ctx.arc(point.x, point.y, 10, 0, Math.PI * 2)
    //   ctx.fillStyle = '#f00'
    //   ctx.fill()
    // }

    this.layer.replaceTextureFromCanvas(this.offscreenCanvas)
  }
}

module.exports = MarqueeSelectionStrategy
