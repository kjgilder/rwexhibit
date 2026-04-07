from PIL import Image
from pathlib import Path


def main() -> None:
    path = Path(__file__).resolve().parents[1] / "assets" / "peabody-lockup-white.png"
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size

    # The provided lockup has a solid black background baked into the PNG.
    # Make that background transparent so the logo doesn't look like a separate dark box.
    bg_thr = 12  # tolerance for near-black pixels
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r <= bg_thr and g <= bg_thr and b <= bg_thr:
                px[x, y] = (r, g, b, 0)

    # Crop to the tight bounds of non-transparent pixels (now that the background is transparent).
    thr = 0
    min_x, min_y = w, h
    max_x, max_y = -1, -1

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y

    if max_x <= min_x or max_y <= min_y:
        raise SystemExit("Could not detect non-background pixels; aborting.")

    pad = 2
    left = max(0, min_x - pad)
    top = max(0, min_y - pad)
    right = min(w, max_x + pad + 1)
    bottom = min(h, max_y + pad + 1)

    out = im.crop((left, top, right, bottom))
    out.save(path)
    print(f"Cleaned {path.name}: {w}x{h} -> {out.size[0]}x{out.size[1]}")


if __name__ == "__main__":
    main()

