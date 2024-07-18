import dask.array as da
import shutil


wells = ["B/03", "B/05"]
levels = list(range(5))
new_chunks = (1, 1, 100, 100)


for well in wells:
    image_path = f"20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/{well}/0/"
    for level in levels:
        array_path = f"{image_path}/{level}"
        array_path_tmp = f"{image_path}/{level}_tmp"
        old_array = da.from_zarr(array_path)
        print(f"{old_array=}")

        # Rechunk and save to disk (to a tmp array)
        new_array = old_array
        new_array = da.rechunk(old_array, chunks=new_chunks)
        print(f"{new_array=}")
        new_array.to_zarr(array_path_tmp, overwrite=True, dimension_separator="/")

        # Move to the original path
        shutil.rmtree(array_path)
        shutil.move(array_path_tmp, array_path)
