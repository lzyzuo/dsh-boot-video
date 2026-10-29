# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-29

首个公开版本。

### 新增
- 打开 DSH 窗口时全屏播放一段开机视频，播完淡出进入界面。
- 点击任意位置 / `Esc` / `Enter` / 空格 跳过；26 秒硬上限兜底。
- 左下角静音开关；带声自动播放被拒时自动退回静音播放。
- `GET /boot-animation/status.json` 与 `GET /boot-animation/video.mp4`，后者支持 HTTP Range（`206` / `416`）。
- 配置项 `enabled` / `sound` / `file`，支持任意本地 mp4。
- 中英文案（DSH locale 服务）。
- 与 `dsh-plugin-wallpaper-engine` 共存：独立浮层、正 z-index、零耦合、播完卸载。

### 说明
- 仓库不附带视频文件；`media/` 在 `.gitignore` 中。
- `status.json` 额外返回 `ready`，视频缺失时客户端直接跳过，不闪黑。
