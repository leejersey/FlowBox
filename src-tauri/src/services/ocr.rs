use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq, Eq)]
pub enum OcrError {
    OutsideAllowedDirectory,
    Unreadable,
    NoText,
    UnsupportedPlatform,
    Vision(String),
}

impl fmt::Display for OcrError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OutsideAllowedDirectory => formatter.write_str("outside allowed directory"),
            Self::Unreadable => formatter.write_str("file unreadable"),
            Self::NoText => formatter.write_str("no text found"),
            Self::UnsupportedPlatform => formatter.write_str("unsupported platform"),
            Self::Vision(message) => write!(formatter, "vision error: {message}"),
        }
    }
}

fn allowed_image(path: &Path, app_data: &Path) -> Result<PathBuf, OcrError> {
    let path = path.canonicalize().map_err(|_| OcrError::Unreadable)?;
    let inside_allowed_root = ["screenshots", "clipboard_images"]
        .into_iter()
        .filter_map(|directory| app_data.join(directory).canonicalize().ok())
        .any(|root| path.starts_with(root));
    if inside_allowed_root {
        Ok(path)
    } else {
        Err(OcrError::OutsideAllowedDirectory)
    }
}

fn recognized_text(candidates: Vec<String>) -> Result<String, OcrError> {
    let text = candidates
        .into_iter()
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    if text.is_empty() {
        Err(OcrError::NoText)
    } else {
        Ok(text)
    }
}

pub fn recognize_text(path: &Path, app_data: &Path) -> Result<String, OcrError> {
    let path = allowed_image(path, app_data)?;
    recognize_with_vision(&path)
}

#[cfg(target_os = "macos")]
fn recognize_with_vision(path: &Path) -> Result<String, OcrError> {
    use objc2::runtime::AnyObject;
    use objc2::AnyThread;
    use objc2_app_kit::NSImage;
    use objc2_foundation::{NSArray, NSDictionary, NSString, NSURL};
    use objc2_vision::{
        VNImageOption, VNImageRequestHandler, VNRecognizeTextRequest, VNRequest,
        VNRequestTextRecognitionLevel,
    };

    let path = path.to_str().ok_or(OcrError::Unreadable)?;
    let path = NSString::from_str(path);
    let _image = NSImage::initWithContentsOfFile(NSImage::alloc(), &path)
        .ok_or(OcrError::Unreadable)?;
    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setRecognitionLanguages(&NSArray::from_retained_slice(&[
        NSString::from_str("zh-Hans"),
        NSString::from_str("en-US"),
    ]));

    let url = NSURL::fileURLWithPath(&path);
    let options: objc2::rc::Retained<NSDictionary<VNImageOption, AnyObject>> =
        NSDictionary::new();
    let handler = unsafe {
        VNImageRequestHandler::initWithURL_options(
            VNImageRequestHandler::alloc(),
            &url,
            &options,
        )
    };
    let requests: objc2::rc::Retained<NSArray<VNRequest>> = NSArray::from_slice(&[&request]);
    handler
        .performRequests_error(&requests)
        .map_err(|error| OcrError::Vision(error.to_string()))?;

    let candidates = request
        .results()
        .into_iter()
        .flat_map(|observations| observations.iter().collect::<Vec<_>>())
        .filter_map(|observation| observation.topCandidates(1).firstObject())
        .map(|candidate| candidate.string().to_string())
        .collect();
    recognized_text(candidates)
}

#[cfg(not(target_os = "macos"))]
fn recognize_with_vision(_path: &Path) -> Result<String, OcrError> {
    Err(OcrError::UnsupportedPlatform)
}

#[cfg(test)]
mod tests {
    use super::{allowed_image, recognized_text, OcrError};
    use std::fs;

    #[test]
    fn only_allows_images_under_app_image_directories() {
        let root = std::env::temp_dir().join(format!("flowbox-ocr-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let screenshots = root.join("screenshots");
        let clipboard = root.join("clipboard_images");
        fs::create_dir_all(&screenshots).unwrap();
        fs::create_dir_all(&clipboard).unwrap();
        let allowed = screenshots.join("allowed.png");
        let outside = root.join("outside.png");
        fs::write(&allowed, []).unwrap();
        fs::write(&outside, []).unwrap();

        assert_eq!(allowed_image(&allowed, &root).unwrap(), allowed.canonicalize().unwrap());
        assert!(matches!(
            allowed_image(&outside, &root),
            Err(OcrError::OutsideAllowedDirectory)
        ));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn empty_candidates_return_no_text() {
        assert!(matches!(recognized_text(Vec::new()), Err(OcrError::NoText)));
    }
}
