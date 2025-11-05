declare module "react-native-expo-image-cropper" {
  import * as React from "react";
  import { ImageManipulatorSaveOptions } from "expo-image-manipulator";

  export interface ExpoImageManipulatorProps {
    photo: { uri: string };
    isVisible: boolean;
    onPictureChoosed: (data: { uri: string }) => void;
    onToggleModal: () => void;
    saveOptions?: ImageManipulatorSaveOptions;
    btnTexts?: { done?: string; processing?: string };
  }

  export const ExpoImageManipulator: React.FC<ExpoImageManipulatorProps>;
}
