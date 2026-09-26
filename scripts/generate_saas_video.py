import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Configuration
WIDTH = 1920
HEIGHT = 1080
FPS = 30
TRANSITION_FRAMES = 15  # 0.5s transition

# Color Palette (RGB)
COLOR_BG1 = (10, 9, 21)        # Deep dark blue-black
COLOR_BG2 = (30, 25, 55)       # Rich dark purple
COLOR_ACCENT = (252, 185, 0)    # Gold
COLOR_TEXT_PRIMARY = (255, 255, 255)
COLOR_TEXT_SECONDARY = (209, 213, 219)  # Light grey
COLOR_CARD_BG = (15, 12, 30, 220)        # Dark transparent card

# Font Loader Helper
def get_font(font_name, size, weight="regular"):
    # Common Windows font paths
    paths = []
    if font_name == "Segoe UI":
        if weight == "bold":
            paths = [
                "C:\\Windows\\Fonts\\segoeuib.ttf",
                "C:\\Windows\\Fonts\\segoeui.ttf",
                "C:\\Windows\\Fonts\\Arial.ttf"
            ]
        else:
            paths = [
                "C:\\Windows\\Fonts\\segoeui.ttf",
                "C:\\Windows\\Fonts\\Arial.ttf"
            ]
    else:  # Default to Arial or system font
        if weight == "bold":
            paths = [
                "C:\\Windows\\Fonts\\arialbd.ttf",
                "C:\\Windows\\Fonts\\Arial.ttf"
            ]
        else:
            paths = [
                "C:\\Windows\\Fonts\\Arial.ttf"
            ]
            
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_gradient_bg(width, height, c1, c2):
    # Generates a vertical gradient
    base = Image.new('RGB', (width, height), c1)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        ratio = y / float(height)
        r = int(c1[0] + (c2[0] - c1[0]) * ratio)
        g = int(c1[1] + (c2[1] - c1[1]) * ratio)
        b = int(c1[2] + (c2[2] - c1[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return base

def render_intro_outro(title, subtitle, accent_title, duration, frame_idx):
    # Base background gradient
    canvas = create_gradient_bg(WIDTH, HEIGHT, COLOR_BG1, COLOR_BG2).convert('RGBA')
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    font_large = get_font("Segoe UI", 90, "bold")
    font_med = get_font("Segoe UI", 36, "regular")
    font_small = get_font("Segoe UI", 24, "bold")
    
    # Calculate text widths/heights and center them
    # Accent Tag
    tag_text = accent_title.upper()
    tag_w = draw.textlength(tag_text, font=font_small)
    tag_x = (WIDTH - tag_w) // 2
    tag_y = HEIGHT // 2 - 140
    # Draw a small pill container for accent
    draw.rounded_rectangle([(tag_x - 20, tag_y - 10), (tag_x + tag_w + 20, tag_y + 35)], 15, fill=(147, 51, 234, 40), outline=(147, 51, 234, 150), width=2)
    draw.text((tag_x, tag_y), tag_text, font=font_small, fill=(192, 132, 252)) # Purple accent
    
    # Title
    t_w = draw.textlength(title, font=font_large)
    t_x = (WIDTH - t_w) // 2
    t_y = HEIGHT // 2 - 40
    # Draw double shadow/glow for title
    draw.text((t_x + 2, t_y + 2), title, font=font_large, fill=(0, 0, 0, 100))
    draw.text((t_x, t_y), title, font=font_large, fill=COLOR_TEXT_PRIMARY)
    
    # Subtitle
    s_w = draw.textlength(subtitle, font=font_med)
    s_x = (WIDTH - s_w) // 2
    s_y = HEIGHT // 2 + 80
    draw.text((s_x, s_y), subtitle, font=font_med, fill=COLOR_TEXT_SECONDARY)
    
    # Composite
    canvas = Image.alpha_composite(canvas, overlay)
    return cv2.cvtColor(np.array(canvas.convert('RGB')), cv2.COLOR_RGB2BGR)

def render_section_transition(section_num, section_name, subtitle, duration, frame_idx):
    canvas = create_gradient_bg(WIDTH, HEIGHT, COLOR_BG1, COLOR_BG2).convert('RGBA')
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    font_huge = get_font("Segoe UI", 160, "bold")
    font_large = get_font("Segoe UI", 56, "bold")
    font_med = get_font("Segoe UI", 32, "regular")
    
    # Large Section Number background glow
    num_text = f"0{section_num}" if isinstance(section_num, int) else section_num
    num_w = draw.textlength(num_text, font=font_huge)
    num_x = (WIDTH - num_w) // 2
    num_y = HEIGHT // 2 - 180
    draw.text((num_x, num_y), num_text, font=font_huge, fill=(147, 51, 234, 25))
    
    # Section Label
    label_text = f"SECTION {num_text}"
    label_font = get_font("Segoe UI", 24, "bold")
    label_w = draw.textlength(label_text, font=label_font)
    draw.text(((WIDTH - label_w) // 2, HEIGHT // 2 - 20), label_text, font=label_font, fill=COLOR_ACCENT)
    
    # Section Name
    name_w = draw.textlength(section_name, font=font_large)
    draw.text(((WIDTH - name_w) // 2, HEIGHT // 2 + 40), section_name, font=font_large, fill=COLOR_TEXT_PRIMARY)
    
    # Subtitle
    sub_w = draw.textlength(subtitle, font=font_med)
    draw.text(((WIDTH - sub_w) // 2, HEIGHT // 2 + 130), subtitle, font=font_med, fill=COLOR_TEXT_SECONDARY)
    
    canvas = Image.alpha_composite(canvas, overlay)
    return cv2.cvtColor(np.array(canvas.convert('RGB')), cv2.COLOR_RGB2BGR)

def render_screenshot_slide(fpath, header, title, callout, duration, frame_idx):
    if not os.path.exists(fpath):
        print(f"Warning: Screenshot file not found: {fpath}")
        # Return fallback black frame
        return np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
        
    # 1. Load screenshot
    img = Image.open(fpath).convert('RGB')
    
    # 2. Compute Ken Burns effect zoom for foreground
    t = frame_idx / float(duration - 1)
    zoom = 1.0 + 0.03 * t  # Zoom in 3%
    
    # 3. Create background (blurred & darkened screenshot)
    # Resize screenshot to cover screen
    bg_w = WIDTH
    bg_h = int(img.height * (bg_w / img.width))
    if bg_h < HEIGHT:
        bg_h = HEIGHT
        bg_w = int(img.width * (bg_h / img.height))
    bg_img = img.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
    
    # Crop to 1920x1080 center
    left = (bg_w - WIDTH) // 2
    top = (bg_h - HEIGHT) // 2
    bg_cropped = bg_img.crop((left, top, left + WIDTH, top + HEIGHT))
    
    # Apply BoxBlur for speed and style
    bg_blurred = bg_cropped.filter(ImageFilter.BoxBlur(45))
    
    # Blend with deep dark blue overlay to darken
    bg = Image.blend(bg_blurred, Image.new('RGB', (WIDTH, HEIGHT), (12, 10, 24)), 0.65)
    
    # Convert to RGBA for drawing
    canvas = bg.convert('RGBA')
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # 4. Scale and center the foreground screenshot card
    max_w, max_h = 1350, 680
    aspect = img.width / img.height
    w = max_w
    h = int(w / aspect)
    if h > max_h:
        h = max_h
        w = int(h * aspect)
        
    zw = int(w * zoom)
    zh = int(h * zoom)
    img_resized = img.resize((zw, zh), Image.Resampling.LANCZOS)
    
    # Define card coordinate
    x = (WIDTH - zw) // 2
    y = (HEIGHT - zh) // 2 - 25  # Shifting up to leave space for text
    
    # 5. Draw rounded mask for card
    radius = 16
    mask = Image.new('L', (zw, zh), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle([(0, 0), (zw, zh)], radius, fill=255)
    
    # 6. Draw soft drop shadows
    for i in range(12):
        offset = 12 - i
        opacity = int(6.0 * (i + 1) / 12.0)
        draw.rounded_rectangle(
            [(x - offset, y - offset), (x + zw + offset, y + zh + offset)],
            radius + offset,
            fill=(0, 0, 0, opacity)
        )
        
    # Draw border
    border_w = 6
    draw.rounded_rectangle(
        [(x - border_w, y - border_w), (x + zw + border_w, y + zh + border_w)],
        radius + border_w,
        fill=(255, 255, 255, 255)
    )
    
    # Paste screenshot card on overlay
    overlay.paste(img_resized, (x, y), mask)
    
    # 7. Render Text Overlays
    # Top Header Label
    font_hdr = get_font("Segoe UI", 20, "bold")
    hdr_text = f"PRANGANPRO  •  {header.upper()}"
    draw.text((x + 10, y - 48), hdr_text, font=font_hdr, fill=COLOR_ACCENT)
    
    # Bottom Caption Card (semi-transparent glassmorphism bar)
    card_x1 = (WIDTH - 1500) // 2
    card_y1 = 890
    card_x2 = card_x1 + 1500
    card_y2 = card_y1 + 130
    
    draw.rounded_rectangle(
        [(card_x1, card_y1), (card_x2, card_y2)],
        15,
        fill=COLOR_CARD_BG,
        outline=(255, 255, 255, 30),
        width=1
    )
    
    # Title & Callout in bottom card
    font_title = get_font("Segoe UI", 32, "bold")
    font_desc = get_font("Segoe UI", 22, "regular")
    
    draw.text((card_x1 + 40, card_y1 + 25), title, font=font_title, fill=COLOR_TEXT_PRIMARY)
    draw.text((card_x1 + 40, card_y1 + 75), callout, font=font_desc, fill=COLOR_TEXT_SECONDARY)
    
    # Composite
    canvas = Image.alpha_composite(canvas, overlay)
    return cv2.cvtColor(np.array(canvas.convert('RGB')), cv2.COLOR_RGB2BGR)

def main():
    print("--- PranganPro SaaS Video Generator ---")
    base_screenshots_dir = r"c:\Users\PC-18\Desktop\New folder (6)\campusmanagment\public\images\screenshots"
    output_path = r"c:\Users\PC-18\Desktop\New folder (6)\campusmanagment\public\pranganpro_saas_demo.mp4"
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    slides = [
        # Intro
        {
            "type": "intro",
            "title": "PRANGANPRO",
            "subtitle": "The Ultimate Intelligent Campus Management SaaS",
            "accent_title": "Product Overview Showcase",
            "duration": 90, # 3 seconds
        },
        # Section 1: Principal
        {
            "type": "section_transition",
            "section_num": 1,
            "section_name": "PRINCIPAL & DIRECTORS CONSOLE",
            "subtitle": "Institutional Governance & Analytics",
            "duration": 60, # 2 seconds
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "principal", "Screenshot 2026-07-08 151749.png"),
            "header": "Principal Portal",
            "title": "Institutional Dashboard",
            "callout": "Real-time key performance indicators tracking admissions, attendance, and financials.",
            "duration": 120, # 4 seconds
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "principal", "Screenshot 2026-07-08 151932.png"),
            "header": "Principal Portal",
            "title": "Academic Calendar & Scheduler",
            "callout": "Plan terms, holidays, exam schedules, and keep the campus synchronized.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "principal", "Screenshot 2026-07-08 152313.png"),
            "header": "Principal Portal",
            "title": "Outcomes-Based Education (OBE)",
            "callout": "Evaluate student outcome metrics and maintain compliance audit trails.",
            "duration": 120,
        },
        # Section 2: Admin
        {
            "type": "section_transition",
            "section_num": 2,
            "section_name": "ADMINISTRATIVE WORKSPACE",
            "subtitle": "Automated Records & Fee Transactions",
            "duration": 60,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "admin", "Screenshot 2026-07-08 155201.png"),
            "header": "Administrative Portal",
            "title": "Central Student Directory",
            "callout": "Access comprehensive profiles, parent notifications, and academic records in one database.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "admin", "Screenshot 2026-07-08 155225.png"),
            "header": "Administrative Portal",
            "title": "Fee Management & Ledgers",
            "callout": "Configure fee categories, track receipts, log waivers, and generate instant invoices.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "admin", "Screenshot 2026-07-08 155241.png"),
            "header": "Administrative Portal",
            "title": "Admission Enquiry Funnel",
            "callout": "Track leads, handle online registrations, verify documents, and convert candidates.",
            "duration": 120,
        },
        # Section 3: Teacher
        {
            "type": "section_transition",
            "section_num": 3,
            "section_name": "TEACHER CONSOLE",
            "subtitle": "Timetable, Attendance, & Lesson Planners",
            "duration": 60,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "teacher", "Screenshot 2026-07-08 153952.png"),
            "header": "Teacher Portal",
            "title": "Faculty Dashboard & Tasks",
            "callout": "Keep tabs on today's scheduled classes, assigned homeworks, and syllabus progress.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "teacher", "Screenshot 2026-07-08 153229.png"),
            "header": "Teacher Portal",
            "title": "Digital Gradebook",
            "callout": "Easily input internal marks, manage exams, and configure customized report card formats.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "teacher", "Screenshot 2026-07-08 154050.png"),
            "header": "Teacher Portal",
            "title": "Attendance Register",
            "callout": "Mark attendance in seconds with auto-sync alerts to student portfolios.",
            "duration": 120,
        },
        # Section 4: Student
        {
            "type": "section_transition",
            "section_num": 4,
            "section_name": "STUDENT PORTAL",
            "subtitle": "Interactive Schedules & Grade Archives",
            "duration": 60,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "student", "Screenshot 2026-07-08 154417.png"),
            "header": "Student Portal",
            "title": "Student Dashboard",
            "callout": "Instant access to timetables, digital homework, fee dues, and teacher messages.",
            "duration": 120,
        },
        {
            "type": "screenshot",
            "path": os.path.join(base_screenshots_dir, "student", "Screenshot 2026-07-08 154358.png"),
            "header": "Student Portal",
            "title": "Grades & Progress History",
            "callout": "View report cards, track subject grade histories, and verify credit sheets.",
            "duration": 120,
        },
        # Outro
        {
            "type": "outro",
            "title": "PRANGANPRO",
            "subtitle": "Modernizing education, one campus at a time.",
            "accent_title": "SaaS Platform Overview",
            "duration": 90,
        }
    ]
    
    # Render all slides frame-by-frame and apply transitions
    print("Initializing video writer...")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, FPS, (WIDTH, HEIGHT))
    
    # Store rendered frames for a single slide to write
    def render_slide(slide):
        stype = slide["type"]
        duration = slide["duration"]
        frames = []
        for f in range(duration):
            if stype == "intro" or stype == "outro":
                frame = render_intro_outro(slide["title"], slide["subtitle"], slide["accent_title"], duration, f)
            elif stype == "section_transition":
                frame = render_section_transition(slide["section_num"], slide["section_name"], slide["subtitle"], duration, f)
            elif stype == "screenshot":
                frame = render_screenshot_slide(slide["path"], slide["header"], slide["title"], slide["callout"], duration, f)
            frames.append(frame)
        return frames
        
    print(f"Total slides to process: {len(slides)}")
    
    # Black frame helper for fade in/out
    black_frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    
    # Generate and process slide by slide to save memory
    prev_slide_frames = None
    
    for i, slide in enumerate(slides):
        print(f"Processing slide {i+1}/{len(slides)}: {slide.get('title', slide.get('section_name', 'screenshot'))}...")
        curr_slide_frames = render_slide(slide)
        
        # If this is the very first slide, fade it in from black
        if i == 0:
            for f_idx in range(TRANSITION_FRAMES):
                alpha = f_idx / float(TRANSITION_FRAMES)
                blended = cv2.addWeighted(curr_slide_frames[f_idx], alpha, black_frame, 1.0 - alpha, 0)
                out.write(blended)
            # Write mid frames of first slide (excluding last 15 frames which will transition to slide 1)
            for f_idx in range(TRANSITION_FRAMES, len(curr_slide_frames) - TRANSITION_FRAMES):
                out.write(curr_slide_frames[f_idx])
            # Keep final 15 frames for transition
            prev_slide_frames = curr_slide_frames[-TRANSITION_FRAMES:]
            
        else:
            # We have a transition from prev_slide to curr_slide
            # Grab first 15 frames of current slide
            curr_first_15 = curr_slide_frames[:TRANSITION_FRAMES]
            
            # Blend them with final 15 of prev_slide
            for f_idx in range(TRANSITION_FRAMES):
                alpha = (f_idx + 1) / float(TRANSITION_FRAMES + 1)
                blended = cv2.addWeighted(curr_first_15[f_idx], alpha, prev_slide_frames[f_idx], 1.0 - alpha, 0)
                out.write(blended)
                
            # Write mid frames of current slide
            if i == len(slides) - 1:
                # This is the last slide! Write middle frames up to final transition
                for f_idx in range(TRANSITION_FRAMES, len(curr_slide_frames) - TRANSITION_FRAMES):
                    out.write(curr_slide_frames[f_idx])
                # Fade out to black on the last 15 frames
                last_15 = curr_slide_frames[-TRANSITION_FRAMES:]
                for f_idx in range(TRANSITION_FRAMES):
                    alpha = f_idx / float(TRANSITION_FRAMES)
                    blended = cv2.addWeighted(black_frame, alpha, last_15[f_idx], 1.0 - alpha, 0)
                    out.write(blended)
            else:
                # Write middle frames
                for f_idx in range(TRANSITION_FRAMES, len(curr_slide_frames) - TRANSITION_FRAMES):
                    out.write(curr_slide_frames[f_idx])
                # Keep final 15 frames for transition
                prev_slide_frames = curr_slide_frames[-TRANSITION_FRAMES:]
                
    out.release()
    print(f"Success! Video generated successfully at: {output_path}")

if __name__ == "__main__":
    main()
