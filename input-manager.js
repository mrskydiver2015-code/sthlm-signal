// Device-independent movement intent. DOM adapters own event delivery;
// this class has no renderer, player, camera, or scene dependencies.
class InputManager {
  constructor() {
    this.keys = {};
    this.joystick = {active:false, dx:0, dy:0};
    this.intent = {horizontal:0, forward:0};
  }
  movement() {
    const k=this.keys, j=this.joystick;
    this.intent.horizontal=Number(!!(k.KeyD||k.ArrowRight))-Number(!!(k.KeyA||k.ArrowLeft))+(j.active?j.dx:0);
    // Screen Y grows down. Convert to logical forward here and nowhere else.
    this.intent.forward=Number(!!(k.KeyW||k.ArrowUp))-Number(!!(k.KeyS||k.ArrowDown))-(j.active?j.dy:0);
    return this.intent;
  }
}
