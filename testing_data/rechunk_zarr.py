import dask.array as da

image_path = "20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0/"
for level in range(5):
    array_path = f"{image_path}/{level}"
    old_array = da.from_zarr(array_path)
    print(f"{old_array=}")
    # Use 1x1x50x50 CZYX chunks
    new_array = da.rechunk(old_array, chunks=(1, 1, 50, 50))
    print(f"{new_array=}")
    new_array.to_zarr(array_path, overwrite=True)