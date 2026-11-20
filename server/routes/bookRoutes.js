import express from "express";
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  discontinueBook,
  purchaseOrRentDigitalBook,
  getMyDigitalShelf,
} from "../controllers/bookController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createBookSchema,
  updateBookSchema,
  idParamSchema,
} from "../validators/bookValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(protect);

// 1. All Books & Create Book
router
  .route("/")
  .get(getBooks)
  .post(
    authorizeRoles("librarian"),
    upload.single("coverImage"),
    validate(createBookSchema),
    createBook
  );

// 2. Purchaser Digital Shelf (Must be placed before `/:id` to avoid route conflict)
router.get("/my-digital-shelf", getMyDigitalShelf);

// 3. Librarian discontinue book route
router.patch(
  "/:id/discontinue",
  authorizeRoles("librarian"),
  validate(idParamSchema, "params"),
  discontinueBook
);

// 4. Digital Rent / Purchase Route
router.post(
  "/:id/digital-access",
  validate(idParamSchema, "params"),
  purchaseOrRentDigitalBook
);

// 5. Individual Book by ID
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
  .delete(
    authorizeRoles("librarian"),
    validate(idParamSchema, "params"),
    deleteBook
  );

export default router;