import sys
from PIL import Image

def remove_white_bg(input_path, output_path, tolerance=10):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    # Simple approach: if pixel is close to white and near the edge, or we can just flood fill.
    # Let's do a flood fill.
    width, height = img.size
    
    # create a mask
    from PIL import ImageDraw
    
    # Since flood fill might be tedious to write manually, let's use a simpler approach:
    # Most AI icons have a centered logo and solid background.
    # Let's make a set of pixels to process (border pixels)
    # and BFS to find all connected background pixels.
    
    background_pixels = set()
    queue = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    # We will consider a pixel as background if its RGB values are all > 255 - tolerance
    def is_bg(r, g, b, a):
        return r > 255 - tolerance and g > 255 - tolerance and b > 255 - tolerance
    
    pixels = img.load()
    
    visited = set()
    for start in queue:
        if start not in visited:
            q = [start]
            while q:
                x, y = q.pop(0)
                if (x, y) in visited:
                    continue
                visited.add((x, y))
                
                # Check if it's bg
                p = pixels[x, y]
                if is_bg(p[0], p[1], p[2], p[3]):
                    background_pixels.add((x, y))
                    # Add neighbors
                    if x > 0: q.append((x-1, y))
                    if x < width - 1: q.append((x+1, y))
                    if y > 0: q.append((x, y-1))
                    if y < height - 1: q.append((x, y+1))

    # Now we have all connected background pixels. Make them transparent.
    for x, y in background_pixels:
        p = pixels[x, y]
        pixels[x, y] = (p[0], p[1], p[2], 0) # transparent
        
    img.save(output_path)
    print(f"Removed {len(background_pixels)} background pixels from {input_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
         print("Usage: python script.py <input> <output>")
         sys.exit(1)
    remove_white_bg(sys.argv[1], sys.argv[2], 25)
