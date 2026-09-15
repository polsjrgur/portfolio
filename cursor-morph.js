(() => {
  const DOT_SCALE = 10 / 78;
  const BORDER_WIDTH = 2.5;
  const ENTRY_DURATION = 630;
  const EXIT_DURATION = 360;
  const LOOP_HOLD = 270;
  const LOOP_TRANSITION = 660;
  const LOOP_DURATION = (LOOP_HOLD + LOOP_TRANSITION) * 2;

  function smoothStep(value) {
    return value * value * (3 - 2 * value);
  }

  function createBezierEasing(x1, y1, x2, y2) {
    const sample = (start, control1, control2, end, value) => {
      const inverse = 1 - value;
      return inverse ** 3 * start
        + 3 * inverse ** 2 * value * control1
        + 3 * inverse * value ** 2 * control2
        + value ** 3 * end;
    };

    return (progress) => {
      const clamped = Math.max(0, Math.min(1, progress));
      let lower = 0;
      let upper = 1;
      let parameter = clamped;

      for (let index = 0; index < 12; index += 1) {
        const sampledX = sample(0, x1, x2, 1, parameter);
        if (Math.abs(sampledX - clamped) < 0.0001) break;
        if (sampledX < clamped) lower = parameter;
        else upper = parameter;
        parameter = (lower + upper) / 2;
      }

      return sample(0, y1, y2, 1, parameter);
    };
  }

  const cursorEaseOut = createBezierEasing(0.16, 1, 0.3, 1);

  function lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  function interpolateShape(start, end, progress) {
    return {
      scale: lerp(start.scale, end.scale, progress),
      borderWidth: lerp(start.borderWidth, end.borderWidth, progress),
      fillAlpha: lerp(start.fillAlpha, end.fillAlpha, progress),
      radius: lerp(start.radius, end.radius, progress),
      rotation: lerp(start.rotation, end.rotation, progress)
    };
  }

  window.createPortfolioCursorMorph = ({ body, cursorVisual }) => {
    let morphTarget = 0;
    let mode = 'idle';
    let transitionElapsed = 0;
    let transitionDuration = 0;
    let transitionStart = null;
    let transitionEndRotation = 90;
    let entryBaseRotation = 0;
    let loopPhase = 0;
    let loopCycle = 0;
    let loopBaseRotation = 90;
    let shape = {
      scale: DOT_SCALE,
      borderWidth: 0,
      fillAlpha: 1,
      radius: 50,
      rotation: 0
    };

    function getEntryShape(elapsed) {
      const keyframes = [
        { time: 0, scale: DOT_SCALE, borderWidth: 0, fillAlpha: 1, radius: 50, rotation: 0, easing: cursorEaseOut },
        { time: 150, scale: 1, borderWidth: BORDER_WIDTH, fillAlpha: 0.16, radius: 46, rotation: 30, easing: cursorEaseOut },
        { time: 345, scale: 1, borderWidth: BORDER_WIDTH, fillAlpha: 0.12, radius: 42, rotation: 42, easing: smoothStep },
        { time: 450, scale: 1, borderWidth: BORDER_WIDTH, fillAlpha: 0.04, radius: 18, rotation: 68, easing: smoothStep },
        { time: 540, scale: 1, borderWidth: BORDER_WIDTH, fillAlpha: 0, radius: 6, rotation: 82, easing: cursorEaseOut },
        { time: ENTRY_DURATION, scale: 1, borderWidth: BORDER_WIDTH, fillAlpha: 0, radius: 0, rotation: 90, easing: cursorEaseOut }
      ];

      const bounded = Math.max(0, Math.min(ENTRY_DURATION, elapsed));
      let endIndex = keyframes.findIndex((frame) => frame.time >= bounded);
      if (endIndex <= 0) return { ...keyframes[0], rotation: entryBaseRotation };
      if (endIndex < 0) endIndex = keyframes.length - 1;

      const start = keyframes[endIndex - 1];
      const end = keyframes[endIndex];
      const rawProgress = (bounded - start.time) / Math.max(1, end.time - start.time);
      const progress = end.easing(rawProgress);
      const nextShape = interpolateShape(start, end, progress);
      nextShape.rotation += entryBaseRotation;
      return nextShape;
    }

    function getLoopRadius(phase) {
      const squareHoldEnd = LOOP_HOLD;
      const circleTransitionEnd = squareHoldEnd + LOOP_TRANSITION;
      const circleHoldEnd = circleTransitionEnd + LOOP_HOLD;

      if (phase <= squareHoldEnd) return 0;
      if (phase < circleTransitionEnd) {
        return 50 * cursorEaseOut((phase - squareHoldEnd) / LOOP_TRANSITION);
      }
      if (phase <= circleHoldEnd) return 50;
      return 50 * (1 - cursorEaseOut((phase - circleHoldEnd) / LOOP_TRANSITION));
    }

    function getLoopRotation(phase) {
      const squareHoldEnd = LOOP_HOLD;
      const circleTransitionEnd = squareHoldEnd + LOOP_TRANSITION;
      const circleHoldEnd = circleTransitionEnd + LOOP_HOLD;

      if (phase <= squareHoldEnd) return 0;
      if (phase < circleTransitionEnd) {
        return 180 * cursorEaseOut((phase - squareHoldEnd) / LOOP_TRANSITION);
      }
      if (phase <= circleHoldEnd) return 180;
      return 180 + 180 * cursorEaseOut((phase - circleHoldEnd) / LOOP_TRANSITION);
    }

    function applyShape() {
      cursorVisual.style.setProperty('--cursor-scale', shape.scale.toFixed(5));
      cursorVisual.style.setProperty('--cursor-border-width', `${shape.borderWidth.toFixed(3)}px`);
      cursorVisual.style.setProperty('--cursor-fill-alpha', shape.fillAlpha.toFixed(4));
      cursorVisual.style.setProperty('--cursor-radius', `${shape.radius.toFixed(3)}%`);
      cursorVisual.style.setProperty('--cursor-rotation', `${shape.rotation.toFixed(3)}deg`);
    }

    function enter() {
      if (morphTarget === 1 && mode !== 'exit') return;
      morphTarget = 1;

      if (mode === 'exit') {
        transitionStart = { ...shape };
        transitionElapsed = 0;
        transitionDuration = 420;
        transitionEndRotation = Math.ceil((shape.rotation + 1) / 90) * 90;
        mode = 'resume';
        return;
      }

      entryBaseRotation = Math.ceil(shape.rotation / 90) * 90;
      transitionElapsed = 0;
      mode = 'enter';
    }

    function exit() {
      if (morphTarget === 0) return;
      morphTarget = 0;
      transitionStart = { ...shape };
      transitionElapsed = 0;
      transitionDuration = EXIT_DURATION;
      transitionEndRotation = shape.rotation + 45;
      mode = 'exit';
    }

    function reset() {
      morphTarget = 0;
      mode = 'idle';
      transitionElapsed = 0;
      transitionStart = null;
      loopPhase = 0;
      loopCycle = 0;
      loopBaseRotation = 90;
      shape = {
        scale: DOT_SCALE,
        borderWidth: 0,
        fillAlpha: 1,
        radius: 50,
        rotation: 0
      };
      body.classList.remove('cursor-outline');
      applyShape();
    }

    function render(deltaTime) {
      if (mode === 'enter') {
        transitionElapsed = Math.min(ENTRY_DURATION, transitionElapsed + deltaTime);
        shape = getEntryShape(transitionElapsed);

        if (transitionElapsed >= ENTRY_DURATION) {
          mode = 'loop';
          loopPhase = 0;
          loopCycle = 0;
          loopBaseRotation = shape.rotation;
        }
      } else if (mode === 'resume') {
        transitionElapsed = Math.min(transitionDuration, transitionElapsed + deltaTime);
        const progress = cursorEaseOut(transitionElapsed / transitionDuration);
        shape = interpolateShape(transitionStart, {
          scale: 1,
          borderWidth: BORDER_WIDTH,
          fillAlpha: 0,
          radius: 0,
          rotation: transitionEndRotation
        }, progress);

        if (transitionElapsed >= transitionDuration) {
          mode = 'loop';
          loopPhase = 0;
          loopCycle = 0;
          loopBaseRotation = transitionEndRotation;
        }
      } else if (mode === 'loop') {
        const loopTime = loopPhase + deltaTime;
        loopCycle += Math.floor(loopTime / LOOP_DURATION);
        loopPhase = loopTime % LOOP_DURATION;
        shape = {
          scale: 1,
          borderWidth: BORDER_WIDTH,
          fillAlpha: 0,
          radius: getLoopRadius(loopPhase),
          rotation: loopBaseRotation + loopCycle * 360 + getLoopRotation(loopPhase)
        };
      } else if (mode === 'exit') {
        transitionElapsed = Math.min(transitionDuration, transitionElapsed + deltaTime);
        const progress = cursorEaseOut(transitionElapsed / transitionDuration);
        shape = interpolateShape(transitionStart, {
          scale: DOT_SCALE,
          borderWidth: 0,
          fillAlpha: 1,
          radius: 50,
          rotation: transitionEndRotation
        }, progress);

        if (transitionElapsed >= transitionDuration) {
          mode = 'idle';
          transitionStart = null;
          shape = {
            scale: DOT_SCALE,
            borderWidth: 0,
            fillAlpha: 1,
            radius: 50,
            rotation: transitionEndRotation
          };
        }
      }

      body.classList.toggle('cursor-outline', mode === 'loop');
      applyShape();
    }

    applyShape();
    return { enter, exit, reset, render };
  };
})();
