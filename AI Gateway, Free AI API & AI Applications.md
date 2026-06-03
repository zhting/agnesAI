---
title: "AI Gateway, Free AI API & AI Applications"
source: "https://agnes-ai.com/doc/agnes-video-v20#heading-endpoint"
author:
published:
created: 2026-06-01
description: "Agnes AI by Sapiens AI is an AI gateway, free AI API platform, and AI application ecosystem featuring Agnes, Echo, and Pavo. Get free AI API credits, create a free AI API key, use free AI API tokens, and access free AI API models for chatbots, AI agents, content tools, image generation, roleplay, productivity, and intelligent workflows. Build and use scalable generative AI across apps through one unified platform."
tags:
  - "clippings"
---
## Agnes-Video-V2.0

Agnes-Video-V2.0 is a next-generation cinematic video generation model designed for high-quality text-to-video, image-to-video, multi-image video generation, and keyframe animation workflows.

It generates high-fidelity videos with strong motion consistency, scene coherence, and visual realism, enabling users to create production-ready video content from text prompts, reference images, or multiple keyframes.

Agnes-Video-V2.0 is suitable for storytelling, marketing videos, product demos, social media content, immersive visual production, and AI-powered creative workflows.

## Model Overview

Agnes-Video-V2.0 is optimized for high-quality video generation and flexible creative control.

It supports:

| Capability | Description |
| --- | --- |
| Text-to-Video | Generate videos directly from text prompts |
| Image-to-Video | Animate a static image into a dynamic video |
| Multi-Image Video | Use multiple reference images to guide video generation |
| Keyframe Animation | Generate smooth transitions between multiple keyframes |
| Scene Motion Control | Control subject movement, camera motion, and scene dynamics through prompts |
| Visual Consistency | Maintain strong subject, style, and scene coherence across frames |
| Cinematic Output | Create visually polished videos for creative and commercial use |
| Asynchronous API | Submit a task first, then retrieve the result by task ID |

## Applicable Scenarios

Agnes-Video-V2.0 is suitable for:

| Scenario | Example Use Cases |
| --- | --- |
| Storytelling | Short films, narrative clips, character scenes |
| Marketing Video | Product ads, campaign videos, promotional content |
| Social Media Content | Reels, Shorts, TikTok-style videos, creative posts |
| Image Animation | Animate portraits, products, characters, or scenes |
| Product Demo | Generate product showcase videos from text or images |
| Keyframe Transition | Smoothly transition between different visual states |
| Game / App Assets | Generate dynamic visual materials for digital products |
| Immersive Content | AI-generated cinematic scenes and atmospheric videos |

## API Information

### Endpoint

| Item | Description |
| --- | --- |
| API Endpoint - Create Task | `https://apihub.agnes-ai.com/v1/videos` |
| API Endpoint - Retrieve Result | `https://apihub.agnes-ai.com/v1/videos/{task_id}` |
| Request Method - Create Task | `POST` |
| Request Method - Retrieve Result | `GET` |
| Content-Type | `application/json` |
| Authentication Method | Bearer Token |
| Authentication Header | `Authorization: Bearer YOUR_API_KEY` |
| Task Type | Asynchronous video generation task |

## Workflow

Agnes-Video-V2.0 uses an asynchronous task-based workflow.

### Step 1: Create a Video Task

Send a `POST` request to:

```
https://apihub.agnes-ai.com/v1/videos
```

The API will return a task ID.

### Step 2: Retrieve the Video Result

Use the task ID to send a `GET` request to:

```
https://apihub.agnes-ai.com/v1/videos/{task_id}
```

The result will include task status, progress, and the final video URL when generation is completed.

## Request Parameters

### Create Video Task

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Fixed as `agnes-video-v2.0` |
| `prompt` | string | Yes | Text description of the video |
| `image` | string / array | No | Input image URL or image URL array |
| `mode` | string | No | Generation mode, such as `ti2vid` or `keyframes` |
| `height` | integer | No | Video height. Default: `768` |
| `width` | integer | No | Video width. Default: `1152` |
| `num_frames` | integer | No | Frame count. Must be `≤ 441` and satisfy `8n + 1` |
| `num_inference_steps` | integer | No | Number of inference steps |
| `seed` | integer | No | Random seed for reproducible results |
| `frame_rate` | number | No | Video FPS. Supported range: `1–60` |
| `negative_prompt` | string | No | Negative prompt describing what to avoid |
| `extra_body.image` | array | No | Input image URLs for multi-image video or keyframe mode |
| `extra_body.mode` | string | No | Extra mode setting, such as `keyframes` |

## Call Examples

### 1\. Text-to-Video Request

Use this request to generate a video directly from a text prompt.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",
    "height": 768,
    "width": 1152,
    "num_frames": 121,
    "frame_rate": 24
  }'
```

---

### 2\. Image-to-Video Request

Use this request to animate a single image.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "The woman slowly turns around and looks back at the camera, natural facial expression, cinematic camera movement",
    "image": "https://example.com/image.png",
    "num_frames": 121,
    "frame_rate": 24
  }'
```

---

### 3\. Multi-Image Video Request

Use this request to generate a video guided by multiple input images.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "Create a smooth transformation scene between the two reference images, cinematic lighting, consistent character identity, natural motion",
    "extra_body": {
      "image": [
        "https://example.com/image1.png",
        "https://example.com/image2.png"
      ]
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```

### 4\. Keyframe Animation Request

Use this request to generate smooth interpolation between keyframes.

```
curl-X POST https://apihub.agnes-ai.com/v1/videos \
-H"Authorization: Bearer YOUR_API_KEY" \
-H"Content-Type: application/json" \
-d'{
    "model": "agnes-video-v2.0",
    "prompt": "Generate a smooth cinematic transition between the keyframes, maintaining visual consistency and natural camera movement",
    "extra_body": {
      "image": [
        "https://example.com/keyframe1.png",
        "https://example.com/keyframe2.png"
      ],
      "mode": "keyframes"
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```

---

### 5\. Retrieve Video Result Request

Use this request to retrieve the task status and final result.

```
curl-X GET https://apihub.agnes-ai.com/v1/videos/{task_id} \
-H"Authorization: Bearer YOUR_API_KEY"
```

## Response Format

### Create Task Response

```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"queued",
  "progress":0,
  "created_at":1774344160
}
```

---

### Retrieve Video Result Response

```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"completed",
  "progress":100,
  "created_at":1774344160,
  "completed_at":1774344311,
  "video_url":"https://storage.googleapis.com/...",
  "size":"1152x768",
  "seconds":"5.0",
  "usage": {
    "duration_seconds":151
  }
}
```

## Field Description

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique task ID |
| `object` | string | Object type, fixed as `video` |
| `model` | string | Model used, fixed as `agnes-video-v2.0` |
| `status` | string | Task status |
| `progress` | integer | Task progress percentage, from `0` to `100` |
| `created_at` | integer | Task creation timestamp |
| `completed_at` | integer | Task completion timestamp. `null` if not completed |
| `video_url` | string | Generated video URL, available when status is `completed` |
| `size` | string | Video resolution, formatted as `width x height` |
| `seconds` | string | Video duration in seconds |
| `usage` | object | Usage information |

## Usage Field Description

| Field | Description |
| --- | --- |
| `duration_seconds` | Total duration of video generation in seconds |

---

## Task Status Description

| Status | Description |
| --- | --- |
| `queued` | Task is waiting in queue |
| `in_progress` | Video is being generated |
| `completed` | Video generation is completed |
| `failed` | Video generation failed |

## Error Codes

| Code | Description |
| --- | --- |
| `400` | Invalid request. Check request parameters |
| `401` | Unauthorized. Check your API key |
| `404` | Task not found |
| `500` | Server error |
| `503` | Service busy. Retry later |

## Pricing

| Type | Price |
| --- | --- |
| Video Duration | 0 ~~0.005~~ $/s |

---

## Features & Compatibility

Agnes-Video-V2.0 supports:

- Text-to-video generation
- Image-to-video generation
- Multi-image guided video generation
- Keyframe animation and smooth interpolation
- Prompt-based motion and scene control
- Cinematic visual output
- Asynchronous task-based video generation
- Polling-based result retrieval
- Seed-based reproducibility
- OpenAI-style API design with task-based extension

## Best Practices

### Text-to-Video Prompt

For text-to-video generation, describe the subject, action, environment, lighting, camera movement, and style.

Recommended structure:

```
[Subject] + [Action] + [Scene] + [Camera Movement] + [Lighting] + [Style]
```

Example:

```
A young astronaut walking across a red desert planet, dust blowing in the wind, slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style
```

---

### Image-to-Video Prompt

For image-to-video generation, describe what should move while keeping the key subject stable.

Example:

```
Animate the character with subtle breathing motion, hair moving gently in the wind, background lights flickering softly, while keeping the face and outfit consistent
```

---

### Multi-Image Prompt

For multi-image generation, describe how the input images should relate to each other.

Example:

```
Use the first image as the starting scene and the second image as the target scene. Create a smooth transformation with consistent lighting, natural motion, and cinematic pacing
```

### Keyframe Prompt

For keyframe animation, describe the transition between frames clearly.

Example:

```
Create a smooth transition from the first keyframe to the second keyframe, maintaining character identity, consistent camera angle, and natural motion between scenes
```

## Parameter Recommendations

| Use Case | Recommended Settings |
| --- | --- |
| Standard video generation | `width: 1152`, `height: 768`, `num_frames: 121`, `frame_rate: 24` |
| Short social video | `num_frames: 81` or `121`, `frame_rate: 24` |
| Smoother motion | Higher `frame_rate`, such as `24` or `30` |
| Reproducible result | Set a fixed `seed` |
| Keyframe transition | Use `extra_body.mode: "keyframes"` |
| Avoid unwanted content | Use `negative_prompt` |

## Notes

- Use `agnes-video-v2.0` as the model name.
- Video generation is asynchronous. You need to create a task first, then retrieve the result by task ID.
- `video_url` is only available when the task status is `completed`.
- `num_frames` must be less than or equal to `441`.
- `num_frames` must satisfy the format `8n + 1`, such as `81`, `121`, `161`, `241`, or `441`.
- For text-to-video, only `model` and `prompt` are required.
- For image-to-video, provide an image URL using `image`.
- For multi-image video, provide multiple image URLs in `extra_body.image`.
- For keyframe animation, set `extra_body.mode` to `keyframes`.
- Pricing for Agnes-Video-V2.0 will be announced soon.