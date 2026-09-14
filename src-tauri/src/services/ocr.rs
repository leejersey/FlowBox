use std::fmt;
use std::path::{Path, PathBuf};

const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum OcrError {
    OutsideAllowedDirectory,
    Unreadable,
    FileTooLarge,
    NoText,
    UnsupportedPlatform,
    Vision(String),
}

impl fmt::Display for OcrError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OutsideAllowedDirectory => formatter.write_str("outside allowed directory"),
            Self::Unreadable => formatter.write_str("file unreadable"),
            Self::FileTooLarge => formatter.write_str("file too large"),
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
    if !inside_allowed_root {
        return Err(OcrError::OutsideAllowedDirectory);
    }
    let metadata = std::fs::metadata(&path).map_err(|_| OcrError::Unreadable)?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err(OcrError::Unreadable);
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(OcrError::FileTooLarge);
    }
    Ok(path)
}

fn read_allowed_image(path: &Path, app_data: &Path) -> Result<Vec<u8>, OcrError> {
    let bytes = std::fs::read(allowed_image(path, app_data)?).map_err(|_| OcrError::Unreadable)?;
    if bytes.is_empty() {
        return Err(OcrError::Unreadable);
    }
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(OcrError::FileTooLarge);
    }
    Ok(bytes)
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
    recognize_with_vision(read_allowed_image(path, app_data)?)
}

#[cfg(target_os = "macos")]
fn recognize_with_vision(bytes: Vec<u8>) -> Result<String, OcrError> {
    use objc2::runtime::AnyObject;
    use objc2::AnyThread;
    use objc2_app_kit::NSImage;
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSString};
    use objc2_vision::{
        VNImageOption, VNImageRequestHandler, VNRecognizeTextRequest, VNRequest,
        VNRequestTextRecognitionLevel,
    };

    let data = NSData::with_bytes(&bytes);
    let _image = NSImage::initWithData(NSImage::alloc(), &data).ok_or(OcrError::Unreadable)?;
    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setRecognitionLanguages(&NSArray::from_retained_slice(&[
        NSString::from_str("zh-Hans"),
        NSString::from_str("en-US"),
    ]));

    let options: objc2::rc::Retained<NSDictionary<VNImageOption, AnyObject>> =
        NSDictionary::new();
    let handler = VNImageRequestHandler::initWithData_options(
        VNImageRequestHandler::alloc(),
        &data,
        &options,
    );
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
fn recognize_with_vision(_bytes: Vec<u8>) -> Result<String, OcrError> {
    Err(OcrError::UnsupportedPlatform)
}

#[cfg(test)]
mod tests {
    use super::{allowed_image, read_allowed_image, recognized_text, OcrError, MAX_IMAGE_BYTES};
    use std::fs::{self, File};

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
        fs::write(&allowed, b"image").unwrap();
        fs::write(&outside, b"image").unwrap();

        assert_eq!(allowed_image(&allowed, &root).unwrap(), allowed.canonicalize().unwrap());
        assert!(matches!(
            allowed_image(&outside, &root),
            Err(OcrError::OutsideAllowedDirectory)
        ));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_non_files_empty_files_and_oversized_files() {
        let root = std::env::temp_dir().join(format!("flowbox-ocr-limits-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let screenshots = root.join("screenshots");
        fs::create_dir_all(&screenshots).unwrap();
        let empty = screenshots.join("empty.png");
        let oversized = screenshots.join("oversized.png");
        fs::write(&empty, []).unwrap();
        File::create(&oversized).unwrap().set_len(MAX_IMAGE_BYTES + 1).unwrap();

        assert!(matches!(allowed_image(&screenshots, &root), Err(OcrError::Unreadable)));
        assert!(matches!(allowed_image(&empty, &root), Err(OcrError::Unreadable)));
        assert!(matches!(allowed_image(&oversized, &root), Err(OcrError::FileTooLarge)));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_small_file_from_allowed_subdirectory() {
        let root = std::env::temp_dir().join(format!("flowbox-ocr-read-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let nested = root.join("clipboard_images/subdir");
        fs::create_dir_all(&nested).unwrap();
        let image = nested.join("image.png");
        fs::write(&image, b"image bytes").unwrap();

        assert_eq!(read_allowed_image(&image, &root).unwrap(), b"image bytes");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn empty_candidates_return_no_text() {
        assert!(matches!(recognized_text(Vec::new()), Err(OcrError::NoText)));
    }
}
