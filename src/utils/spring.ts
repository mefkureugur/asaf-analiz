/* =====================================================================
   YAY MOTORU
   Apple'ın "Designing Fluid Interfaces" yaklaşımının web karşılığı.

   Neden CSS transition değil: CSS geçişi uçarken yakalanıp ters
   çevrilemez. Yay her zaman EKRANDAKİ ANLIK DEĞERDEN başlar, bu yüzden
   kesme (interruption) sıçrama üretmez. Jest sürerken hedef değişse bile
   hareket sürekli kalır.

   Parametreler Apple'ın ikilisi:
     damping  — aşma miktarı. 1.0 = kritik sönümlü (aşma yok).
     response — hedefe varış hızı, saniye. Süre DEĞİL; süre fizikten doğar.
   ===================================================================== */

export interface SpringOptions {
  /** Aşma. 1.0 kritik sönümlü, <1 zıplar. Varsayılan 1.0 */
  damping?: number;
  /** Varış hızı (saniye). Düşük = daha çevik. Varsayılan 0.35 */
  response?: number;
  /** Başlangıç hızı (px/s). Jest bırakıldığında parmağın hızı verilir. */
  velocity?: number;
  /** Her karede çağrılır. */
  onUpdate: (value: number) => void;
  /** Yay dinlendiğinde çağrılır (kesilirse çağrılmaz). */
  onRest?: () => void;
}

export interface SpringHandle {
  /** Hedefi değiştir. Hareket anlık değer ve hızdan devam eder (§3). */
  setTarget: (target: number) => void;
  /** Animasyonu durdur; anlık değer ve hız korunur. */
  stop: () => void;
  /** Ekrandaki anlık değer. */
  getValue: () => number;
  /** Anlık hız (px/s). Kesme anında devretmek için. */
  getVelocity: () => number;
}

/** Hareket azaltma tercihi açık mı (§14). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Bir yay animasyonu başlatır ve kontrol tutamacı döndürür.
 * Değer boyunca sürekli çalışır; setTarget ile uçarken yön değiştirilebilir.
 */
export function createSpring(from: number, to: number, opts: SpringOptions): SpringHandle {
  const damping = opts.damping ?? 1.0;
  const response = opts.response ?? 0.35;

  let value = from;
  let velocity = opts.velocity ?? 0;
  let target = to;
  let frame = 0;
  let last = 0;
  let running = false;

  // Apple'ın (damping, response) ikilisinden klasik fiziğe geçiş.
  // omega: doğal açısal frekans, zeta: sönüm oranı.
  const omega = (2 * Math.PI) / response;
  const zeta = damping;

  // Hareket azaltma açıksa fizik atlanır: tek karede hedefe git (§14).
  if (prefersReducedMotion()) {
    value = target;
    opts.onUpdate(value);
    opts.onRest?.();
    return {
      setTarget: (t) => { target = t; value = t; opts.onUpdate(t); opts.onRest?.(); },
      stop: () => {},
      getValue: () => value,
      getVelocity: () => 0,
    };
  }

  const REST_DELTA = 0.1;   // px — bu kadar yaklaşınca dinlenmiş say
  const REST_SPEED = 0.5;   // px/s

  const step = (now: number) => {
    if (!running) return;

    // dt'yi sınırla: sekme arka plana alınıp geri gelince tek dev adım atıp
    // elemanın ekranda sıçramasını engeller.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    const displacement = value - target;

    // Yarı-örtük Euler: bu ölçekte kararlı ve ucuz.
    const accel = -omega * omega * displacement - 2 * zeta * omega * velocity;
    velocity += accel * dt;
    value += velocity * dt;

    if (Math.abs(value - target) < REST_DELTA && Math.abs(velocity) < REST_SPEED) {
      value = target;
      velocity = 0;
      running = false;
      opts.onUpdate(value);
      opts.onRest?.();
      return;
    }

    opts.onUpdate(value);
    frame = requestAnimationFrame(step);
  };

  running = true;
  last = performance.now();
  frame = requestAnimationFrame(step);

  return {
    setTarget(t: number) {
      target = t;
      // Hız KORUNUR — sıfırlanmaz. Yön değişiminde "duvara çarpma"
      // hissini önleyen şey budur (§3).
      if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    getValue: () => value,
    getVelocity: () => velocity,
  };
}

/**
 * Momentum izdüşümü (§6).
 * Bırakma noktasına değil, jestin GİTTİĞİ yere göre karar verir.
 * Apple'ın örnek kodundaki üstel sönüm formülü — ders kitabındaki
 * v²/(2a) değil.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Lastik bant direnci (§9).
 * Sınırın ötesinde ilerledikçe eleman parmağı giderek daha az takip eder.
 * Sert duruş "donmuş", kademeli direnç "burada başka bir şey yok" der.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Son birkaç pointer olayından hız hesaplar (px/s).
 * Tek karelik fark gürültülüdür; kısa bir pencere kullanmak
 * bırakma anındaki hızı çok daha doğru verir (§2).
 */
export class VelocityTracker {
  private samples: { v: number; t: number }[] = [];
  private windowMs: number;

  constructor(windowMs = 100) {
    this.windowMs = windowMs;
  }

  add(value: number, time = performance.now()) {
    this.samples.push({ v: value, t: time });
    const cutoff = time - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  /** px/s cinsinden hız. Örnek yetersizse 0. */
  get(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return (last.v - first.v) / dt;
  }

  reset() {
    this.samples = [];
  }
}
