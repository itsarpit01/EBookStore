import express from "express";
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  discontinueBook,
} from "../controllers/bookController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createBookSchema, updateBookSchema, idParamSchema } from "../validators/bookValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(protect); 

router
  .route("/")
  .get(getBooks)
  .post(authorizeRoles("librarian"), upload.single("coverImage"), validate(createBookSchema), createBook);

// Librarian discontinue book route (requires date mandatory, optional reason)
router.patch(
  "/:id/discontinue",
  authorizeRoles("librarian"),
  validate(idParamSchema, "params"),
  discontinueBook
);

router
  .route("/:id")
  .get(validate(idParamSchema, "params"), getBookById)
  .put(
    authorizeRoles("librarian"),
    validate(idParamSchema, "params"),
    upload.single("coverImage"),
    validate(updateBookSchema),
    updateBook
  )
  .delete(authorizeRoles("librarian"), validate(idParamSchema, "params"), deleteBook);

export default router;