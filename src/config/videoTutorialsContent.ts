export interface VideoTutorial {
  id: string;
  moduleId: string;
  title: string;
  titlePl?: string;
  description: string;
  descriptionPl?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  duration?: string;
  tags?: string[];
}

export const VIDEO_TUTORIALS: VideoTutorial[] = [];

export function getVideosForModule(id: string) {
  return VIDEO_TUTORIALS.filter((video) => video.moduleId === id);
}
