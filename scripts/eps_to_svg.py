import os
import re

def eps_to_svg(eps_path, svg_path):
    with open(eps_path, 'r', encoding='latin-1') as f:
        content = f.read()

    # Get BoundingBox
    bbox_match = re.search(r'%%HiResBoundingBox:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)', content)
    if not bbox_match:
        bbox_match = re.search(r'%%BoundingBox:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)', content)
    
    if bbox_match:
        min_x, min_y, max_x, max_y = map(float, bbox_match.groups())
        width = max_x - min_x
        height = max_y - min_y
    else:
        min_x, min_y, width, height = 0, 0, 400, 200

    lines = content.splitlines()
    svg_elements = []
    
    current_path = []
    current_color = (0, 0, 0)
    current_line_width = 1.0
    
    for line in lines:
        line = line.strip()
        if not line or line.startswith('%'):
            continue
        
        # Color: r g b setcolor
        if line.endswith('setcolor'):
            parts = line.split()
            if len(parts) >= 4:
                try:
                    r, g, b = float(parts[-4]), float(parts[-3]), float(parts[-2])
                    current_color = (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))
                except:
                    pass
        elif line.endswith('setgray'):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    g = float(parts[-2])
                    val = int(round(g * 255))
                    current_color = (val, val, val)
                except:
                    pass
        elif line.endswith('setlinewidth'):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    current_line_width = float(parts[-2])
                except:
                    pass
        elif line == 'newpath':
            current_path = []
        elif line.endswith(' m'):
            parts = line.split()
            if len(parts) >= 3:
                x = float(parts[-3]) - min_x
                y = height - (float(parts[-2]) - min_y)
                current_path.append(f'M {x:.3f} {y:.3f}')
        elif line.endswith(' l'):
            parts = line.split()
            if len(parts) >= 3:
                x = float(parts[-3]) - min_x
                y = height - (float(parts[-2]) - min_y)
                current_path.append(f'L {x:.3f} {y:.3f}')
        elif line.endswith(' c'):
            parts = line.split()
            if len(parts) >= 7:
                x1 = float(parts[-7]) - min_x
                y1 = height - (float(parts[-6]) - min_y)
                x2 = float(parts[-5]) - min_x
                y2 = height - (float(parts[-4]) - min_y)
                x3 = float(parts[-3]) - min_x
                y3 = height - (float(parts[-2]) - min_y)
                current_path.append(f'C {x1:.3f} {y1:.3f} {x2:.3f} {y2:.3f} {x3:.3f} {y3:.3f}')
        elif line == 'closepath':
            current_path.append('Z')
        elif line in ('eofill', 'fill'):
            if current_path:
                d = ' '.join(current_path)
                color_hex = f'#{current_color[0]:02x}{current_color[1]:02x}{current_color[2]:02x}'
                fill_rule = 'evenodd' if line == 'eofill' else 'nonzero'
                svg_elements.append(f'  <path d="{d}" fill="{color_hex}" fill-rule="{fill_rule}" />')
                current_path = []
        elif line == 'stroke':
            if current_path:
                d = ' '.join(current_path)
                color_hex = f'#{current_color[0]:02x}{current_color[1]:02x}{current_color[2]:02x}'
                svg_elements.append(f'  <path d="{d}" fill="none" stroke="{color_hex}" stroke-width="{current_line_width}" />')
                current_path = []

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.3f} {height:.3f}" width="100%" height="100%">
  <g id="logo-layer">
{chr(10).join(svg_elements)}
  </g>
</svg>'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f'Generated: {svg_path} ({len(svg_elements)} paths, {width:.1f}x{height:.1f}px)')

if __name__ == '__main__':
    dark_eps = r'c:\Users\rubbe\Documents\ALCheMy\design_system\assets\logo\logo_alchemy_dark.eps'
    dark_svg = r'c:\Users\rubbe\Documents\ALCheMy\design_system\assets\logo\logo_alchemy_dark.svg'
    light_eps = r'c:\Users\rubbe\Documents\ALCheMy\design_system\assets\logo\logo_alchemy_light.eps'
    light_svg = r'c:\Users\rubbe\Documents\ALCheMy\design_system\assets\logo\logo_alchemy_light.svg'
    
    eps_to_svg(dark_eps, dark_svg)
    eps_to_svg(light_eps, light_svg)
