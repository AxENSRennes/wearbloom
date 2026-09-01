# PP-HumanSeg model

`human_segmentation_pphumanseg_2023mar.onnx` is the FP32 PP-HumanSeg model distributed by the OpenCV Model Zoo.

- Source: https://huggingface.co/opencv/human_segmentation_pphumanseg
- License: Apache License 2.0
- Input resolution used by this project: 192 × 192
- SHA-256: `552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24`

The FP32 model is used instead of the smaller per-tensor INT8 variant because OpenCV's published evaluation reports substantially better segmentation accuracy for FP32.
