import unittest

from fibonacci import fibonacci


class TestFibonacci(unittest.TestCase):
    def test_zero(self):
        self.assertEqual(fibonacci(0), [])

    def test_one(self):
        self.assertEqual(fibonacci(1), [0])

    def test_two(self):
        self.assertEqual(fibonacci(2), [0, 1])

    def test_ten(self):
        self.assertEqual(fibonacci(10), [0, 1, 1, 2, 3, 5, 8, 13, 21, 34])

    def test_negative_raises(self):
        with self.assertRaises(ValueError):
            fibonacci(-1)


if __name__ == "__main__":
    unittest.main()
